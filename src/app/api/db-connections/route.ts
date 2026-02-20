import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { encrypt } from "@/lib/encryption";
import { testConnection } from "@/lib/schema-extractor";

export async function GET() {
  try {
    const connections = await prisma.dbConnection.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        databaseName: true,
        username: true,
        folderId: true,
        lastExtractedAt: true,
        createdAt: true,
        // Exclude encryptedPassword and cached data from list
      },
    });

    return successResponse(connections);
  } catch (error) {
    console.error("GET /api/db-connections error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list connections", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, host, port, database, username, password, folderId } = body;

    if (!name || !host || !database || !username || !password) {
      return errorResponse(
        "VALIDATION_ERROR",
        "name, host, database, username, and password are required",
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

    // Test connection before saving
    try {
      await testConnection({
        host,
        port: port || 5432,
        database,
        user: username,
        password,
      });
    } catch (connError) {
      const message =
        connError instanceof Error ? connError.message : "Connection failed";
      return errorResponse("CONNECTION_FAILED", `Could not connect: ${message}`, 422);
    }

    const encryptedPassword = encrypt(password);

    const connection = await prisma.dbConnection.create({
      data: {
        name,
        host,
        port: port || 5432,
        databaseName: database,
        username,
        encryptedPassword,
        folderId: folderId || null,
        userId: DEFAULT_USER_ID,
      },
    });

    return successResponse(
      {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        databaseName: connection.databaseName,
        username: connection.username,
        createdAt: connection.createdAt,
      },
      201
    );
  } catch (error) {
    console.error("POST /api/db-connections error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create connection", 500);
  }
}
