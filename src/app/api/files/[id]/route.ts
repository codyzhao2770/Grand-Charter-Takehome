import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { readFile, deleteFile } from "@/lib/storage";

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
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/files/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to download file", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, folderId } = body;

    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    const updateData: { name?: string; folderId?: string | null } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("VALIDATION_ERROR", "File name cannot be empty", 400);
      }
      updateData.name = name.trim();
    }

    if (folderId !== undefined) {
      if (folderId !== null) {
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, userId: DEFAULT_USER_ID },
        });
        if (!folder) {
          return errorResponse("NOT_FOUND", "Target folder not found", 404);
        }
      }
      updateData.folderId = folderId;
    }

    const updated = await prisma.file.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ ...updated, size: Number(updated.size) });
  } catch (error) {
    console.error("PATCH /api/files/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to update file", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    await deleteFile(file.storagePath);
    await prisma.file.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/files/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to delete file", 500);
  }
}
