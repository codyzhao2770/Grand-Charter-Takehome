import { Pool } from "pg";
import type { Index } from "./types";

interface RawIndex {
  index_name: string;
  table_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
}

export async function extractIndexes(pool: Pool): Promise<Index[]> {
  const result = await pool.query<RawIndex>(`
    SELECT
      i.relname AS index_name,
      t.relname AS table_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary,
      am.amname AS index_type
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON i.relam = am.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public'
    ORDER BY t.relname, i.relname, k.ord
  `);

  const indexMap = new Map<string, Index>();

  for (const row of result.rows) {
    if (!indexMap.has(row.index_name)) {
      indexMap.set(row.index_name, {
        name: row.index_name,
        tableName: row.table_name,
        columns: [],
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        indexType: row.index_type,
      });
    }
    indexMap.get(row.index_name)!.columns.push(row.column_name);
  }

  return Array.from(indexMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
