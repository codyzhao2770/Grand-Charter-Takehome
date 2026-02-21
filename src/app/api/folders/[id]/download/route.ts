import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { readFile } from "@/lib/storage";
import archiver from "archiver";
import { PassThrough } from "stream";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const folder = await prisma.folder.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!folder) {
      return errorResponse("NOT_FOUND", "Folder not found", 404);
    }

    // Get all descendant folders with their paths
    const allFolders = await prisma.$queryRaw<{ id: string; name: string; parent_id: string | null }[]>`
      WITH RECURSIVE folder_tree AS (
        SELECT id, name, parent_id FROM folders WHERE id = ${id}::uuid
        UNION ALL
        SELECT f.id, f.name, f.parent_id FROM folders f JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT id, name, parent_id FROM folder_tree
    `;

    // Build folder path map (folder id -> relative path inside zip)
    const pathMap = new Map<string, string>();
    pathMap.set(id, "");

    // Resolve paths iteratively
    const remaining = allFolders.filter((f) => f.id !== id);
    let maxIterations = remaining.length * 2;
    while (remaining.length > 0 && maxIterations-- > 0) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        const f = remaining[i];
        const parentPath = f.parent_id ? pathMap.get(f.parent_id) : undefined;
        if (parentPath !== undefined) {
          pathMap.set(f.id, parentPath ? `${parentPath}/${f.name}` : f.name);
          remaining.splice(i, 1);
        }
      }
    }

    // Get all files in the folder tree
    const files = await prisma.$queryRaw<{ storage_path: string; name: string; folder_id: string }[]>`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM folders WHERE id = ${id}::uuid
        UNION ALL
        SELECT f.id FROM folders f JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT fi.storage_path, fi.name, fi.folder_id
      FROM files fi
      WHERE fi.folder_id IN (SELECT id FROM folder_tree)
    `;

    // Create zip archive
    const archive = archiver("zip", { zlib: { level: 5 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    // Add files with their folder paths
    for (const file of files) {
      try {
        const buffer = await readFile(file.storage_path);
        const folderPath = pathMap.get(file.folder_id) || "";
        const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;
        archive.append(buffer, { name: filePath });
      } catch {
        // Skip files that can't be read
      }
    }

    await archive.finalize();

    // Collect the stream into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const zipBuffer = Buffer.concat(chunks);

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(folder.name)}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/folders/[id]/download error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to download folder", 500);
  }
}
