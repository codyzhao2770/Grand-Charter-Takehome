import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
      100
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10) || 0,
      0
    );

    if (!q || q.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "Search query is required", 400);
    }

    const searchTerm = `%${q.trim()}%`;

    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          name: { contains: q.trim(), mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.folder.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          name: { contains: q.trim(), mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
    ]);

    const dbConnections = await prisma.$queryRaw<
      { id: string; name: string }[]
    >`
      SELECT id, name FROM db_connections
      WHERE user_id = ${DEFAULT_USER_ID}::uuid
        AND cached_schema::text ILIKE ${searchTerm}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return successResponse({
      files: files.map((f) => ({ ...f, size: Number(f.size), type: "file" as const })),
      folders: folders.map((f) => ({ ...f, type: "folder" as const })),
      dbConnections: dbConnections.map((c) => ({ ...c, type: "db_connection" as const })),
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return errorResponse("INTERNAL_ERROR", "Search failed", 500);
  }
}
