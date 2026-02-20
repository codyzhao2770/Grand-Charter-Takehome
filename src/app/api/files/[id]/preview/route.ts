import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { readFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });

    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    const buffer = await readFile(file.storagePath);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/files/[id]/preview error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to preview file", 500);
  }
}
