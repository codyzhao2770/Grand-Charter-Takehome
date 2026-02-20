import { NextRequest } from "next/server";
import { Pool } from "pg";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { decrypt } from "@/lib/encryption";
import { generateSQL, validateSQLSafety } from "@/lib/ai/text-to-sql";
import type { ExtractedSchema } from "@/lib/schema-extractor/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "query is required", 400);
    }

    const connection = await prisma.dbConnection.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!connection) {
      return errorResponse("NOT_FOUND", "Connection not found", 404);
    }

    if (!connection.cachedSchema) {
      return errorResponse(
        "PRECONDITION_FAILED",
        "Schema must be extracted first. POST to /extract before querying.",
        412
      );
    }

    const schema = connection.cachedSchema as unknown as ExtractedSchema;

    // Generate SQL from natural language
    let generated;
    try {
      generated = await generateSQL(schema, query.trim());
    } catch (aiError) {
      const message =
        aiError instanceof Error ? aiError.message : "SQL generation failed";
      return errorResponse("AI_ERROR", message, 422);
    }

    // Validate SQL safety
    const safety = validateSQLSafety(generated.sql);
    if (!safety.safe) {
      return errorResponse("UNSAFE_SQL", safety.reason || "Query is not safe to execute", 403);
    }

    // Execute on the external DB using a read-only transaction
    const password = decrypt(connection.encryptedPassword);
    const pool = new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.databaseName,
      user: connection.username,
      password,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN READ ONLY");
        const result = await client.query(generated.sql);
        await client.query("COMMIT");

        return successResponse({
          sql: generated.sql,
          explanation: generated.explanation,
          columns: result.fields.map((f) => f.name),
          rows: result.rows,
          rowCount: result.rowCount,
        });
      } catch (queryError) {
        await client.query("ROLLBACK").catch(() => {});
        const message =
          queryError instanceof Error ? queryError.message : "Query execution failed";
        return errorResponse("QUERY_ERROR", message, 422);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("POST /api/db-connections/[id]/query error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to execute query", 500);
  }
}
