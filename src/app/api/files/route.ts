import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID, MAX_FILE_SIZE } from "@/lib/constants";
import { saveFile } from "@/lib/storage";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    const files = await prisma.file.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        folderId: folderId || null,
      },
      orderBy: { name: "asc" },
    });

    // Convert BigInt size to number for JSON serialization
    const serialized = files.map((f) => ({
      ...f,
      size: Number(f.size),
    }));

    return successResponse(serialized);
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await saveFile(DEFAULT_USER_ID, fileId, file.name, buffer);

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
