import { Pool, PoolConfig } from "pg";
import { extractTables } from "./tables";
import { extractRelationships } from "./relationships";
import { extractEnums } from "./enums";
import { extractIndexes } from "./indexes";
import { inferInterfaces } from "./interfaces";
import type { ExtractedSchema } from "./types";

export type { ExtractedSchema } from "./types";

export async function extractSchema(config: PoolConfig): Promise<ExtractedSchema> {
  const pool = new Pool(config);

  try {
    // Test connection
    const client = await pool.connect();
    client.release();

    // Extract all schema components in parallel
    const [tables, relationships, enums, indexes] = await Promise.all([
      extractTables(pool),
      extractRelationships(pool),
      extractEnums(pool),
      extractIndexes(pool),
    ]);

    // Infer TypeScript interfaces from schema data
    const interfaces = inferInterfaces(tables, relationships, enums);

    return {
      tables,
      relationships,
      enums,
      indexes,
      interfaces,
      extractedAt: new Date().toISOString(),
    };
  } finally {
    await pool.end();
  }
}

export async function testConnection(config: PoolConfig): Promise<void> {
  const pool = new Pool({ ...config, connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
  } finally {
    await pool.end();
  }
}
