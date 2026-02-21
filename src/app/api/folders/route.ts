import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { paginatedResponse, errorResponse, parsePaginationParams } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const { limit, offset, sortBy, sortOrder } = parsePaginationParams(searchParams);

    const orderByField = sortBy === "createdAt" ? "createdAt" : "name";
    const where = {
      userId: DEFAULT_USER_ID,
      parentId: parentId || null,
    };

    const [folders, total] = await Promise.all([
      prisma.folder.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { children: true, files: true } },
        },
      }),
      prisma.folder.count({ where }),
    ]);

    return paginatedResponse(folders, total, limit, offset);
  } catch (error) {
    console.error("GET /api/folders error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list folders", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "Folder name is required", 400);
    }

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId: DEFAULT_USER_ID },
      });
      if (!parent) {
        return errorResponse("NOT_FOUND", "Parent folder not found", 404);
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        userId: DEFAULT_USER_ID,
      },
    });

    return successResponse(folder, 201);
  } catch (error) {
    console.error("POST /api/folders error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create folder", 500);
  }
}
