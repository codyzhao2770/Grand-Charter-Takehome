import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const connection = await prisma.dbConnection.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        databaseName: true,
        username: true,
        folderId: true,
        cachedSchema: true,
        cachedDocs: true,
        lastExtractedAt: true,
        createdAt: true,
      },
    });

    if (!connection) {
      return errorResponse("NOT_FOUND", "Connection not found", 404);
    }

    return successResponse(connection);
  } catch (error) {
    console.error("GET /api/db-connections/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to get connection", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const connection = await prisma.dbConnection.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!connection) {
      return errorResponse("NOT_FOUND", "Connection not found", 404);
    }

    await prisma.dbConnection.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/db-connections/[id] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to delete connection", 500);
  }
}
