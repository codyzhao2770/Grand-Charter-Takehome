import { Pool } from "pg";
import type { Relationship } from "./types";

interface RawRelationship {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  update_rule: string;
  delete_rule: string;
}

export async function extractRelationships(pool: Pool): Promise<Relationship[]> {
  const result = await pool.query<RawRelationship>(`
    SELECT
      tc.constraint_name,
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  return result.rows.map((row) => ({
    constraintName: row.constraint_name,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    targetTable: row.target_table,
    targetColumn: row.target_column,
    updateRule: row.update_rule,
    deleteRule: row.delete_rule,
  }));
}
