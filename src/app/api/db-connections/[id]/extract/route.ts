import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { decrypt } from "@/lib/encryption";
import { extractSchema } from "@/lib/schema-extractor";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const connection = await prisma.dbConnection.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!connection) {
      return errorResponse("NOT_FOUND", "Connection not found", 404);
    }

    const password = decrypt(connection.encryptedPassword);

    let schema;
    try {
      schema = await extractSchema({
        host: connection.host,
        port: connection.port,
        database: connection.databaseName,
        user: connection.username,
        password,
      });
    } catch (extractError) {
      const message =
        extractError instanceof Error ? extractError.message : "Extraction failed";
      return errorResponse("EXTRACTION_FAILED", `Schema extraction failed: ${message}`, 422);
    }

    // Cache the extracted schema
    await prisma.dbConnection.update({
      where: { id },
      data: {
        cachedSchema: JSON.parse(JSON.stringify(schema)),
        lastExtractedAt: new Date(),
      },
    });

    return successResponse(schema);
  } catch (error) {
    console.error("POST /api/db-connections/[id]/extract error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to extract schema", 500);
  }
}
