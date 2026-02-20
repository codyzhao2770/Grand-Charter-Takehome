import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { deleteFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const folder = await prisma.folder.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      include: {
        children: { orderBy: { name: "asc" } },
        files: { orderBy: { name: "asc" } },
      },
    });

    if (!folder) {
      return errorResponse("NOT_FOUND", "Folder not found", 404);
    }

    return successResponse(folder);
  } catch (error) {
    console.error("GET /api/folders/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to get folder", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, parentId } = body;

    const folder = await prisma.folder.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!folder) {
      return errorResponse("NOT_FOUND", "Folder not found", 404);
    }

    const updateData: { name?: string; parentId?: string | null } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("VALIDATION_ERROR", "Folder name cannot be empty", 400);
      }
      updateData.name = name.trim();
    }

    if (parentId !== undefined) {
      if (parentId === id) {
        return errorResponse("CONFLICT", "Cannot move folder into itself", 409);
      }

      if (parentId !== null) {
        const targetFolder = await prisma.folder.findFirst({
          where: { id: parentId, userId: DEFAULT_USER_ID },
        });
        if (!targetFolder) {
          return errorResponse("NOT_FOUND", "Target folder not found", 404);
        }

        // Check for circular reference
        const ancestors = await prisma.$queryRaw<{ id: string }[]>`
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id FROM folders WHERE id = ${parentId}::uuid
            UNION ALL
            SELECT f.id, f.parent_id FROM folders f JOIN ancestors a ON f.id = a.parent_id
          )
          SELECT id FROM ancestors WHERE id = ${id}::uuid
        `;

        if (ancestors.length > 0) {
          return errorResponse(
            "CONFLICT",
            "Cannot move folder: would create circular reference",
            409
          );
        }
      }

      updateData.parentId = parentId;
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    console.error("PATCH /api/folders/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to update folder", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const folder = await prisma.folder.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!folder) {
      return errorResponse("NOT_FOUND", "Folder not found", 404);
    }

    // Find all descendant files to delete from disk
    const descendantFiles = await prisma.$queryRaw<{ storage_path: string }[]>`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM folders WHERE id = ${id}::uuid
        UNION ALL
        SELECT f.id FROM folders f JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT storage_path FROM files WHERE folder_id IN (SELECT id FROM folder_tree)
    `;

    // Delete files from disk
    await Promise.all(
      descendantFiles.map((f) => deleteFile(f.storage_path))
    );

    // Cascade delete via Prisma (DB handles children + files)
    await prisma.folder.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/folders/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to delete folder", 500);
  }
}
