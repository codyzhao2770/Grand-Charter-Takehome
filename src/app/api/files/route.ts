import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { paginatedResponse, successResponse, errorResponse, parsePaginationParams } from "@/lib/api-response";
import { DEFAULT_USER_ID, MAX_FILE_SIZE } from "@/lib/constants";
import { saveFileStream } from "@/lib/storage";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const { limit, offset, sortBy, sortOrder } = parsePaginationParams(searchParams);

    const orderByField = sortBy === "createdAt" ? "createdAt" : "name";
    const where = {
      userId: DEFAULT_USER_ID,
      folderId: folderId || null,
    };

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.file.count({ where }),
    ]);

    const serialized = files.map((f) => ({
      ...f,
      size: Number(f.size),
    }));

    return paginatedResponse(serialized, total, limit, offset);
  } catch (error) {
    console.error("GET /api/files error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list files", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file) {
      return errorResponse("VALIDATION_ERROR", "File is required", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "VALIDATION_ERROR",
        `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: DEFAULT_USER_ID },
      });
      if (!folder) {
        return errorResponse("NOT_FOUND", "Folder not found", 404);
      }
    }

    const fileId = randomUUID();
    const storagePath = await saveFileStream(
      DEFAULT_USER_ID,
      fileId,
      file.name,
      file.stream()
    );

    const dbFile = await prisma.file.create({
      data: {
        id: fileId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storagePath,
        folderId: folderId || null,
        userId: DEFAULT_USER_ID,
      },
    });

    return successResponse(
      { ...dbFile, size: Number(dbFile.size) },
      201
    );
  } catch (error) {
    console.error("POST /api/files error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to upload file", 500);
  }
}
