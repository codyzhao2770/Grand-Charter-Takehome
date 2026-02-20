import { Pool } from "pg";
import type { Table, Column } from "./types";

interface RawColumn {
  table_name: string;
  table_schema: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  ordinal_position: number;
}

interface RawConstraint {
  table_name: string;
  column_name: string;
  constraint_type: string;
}

interface RawRowCount {
  table_name: string;
  row_estimate: string;
}

export async function extractTables(pool: Pool): Promise<Table[]> {
  // Get all columns
  const columnsResult = await pool.query<RawColumn>(`
    SELECT
      c.table_name,
      c.table_schema,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length,
      c.numeric_precision,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `);

  // Get primary keys and unique constraints
  const constraintsResult = await pool.query<RawConstraint>(`
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
  `);

  // Get row count estimates
  const rowCountResult = await pool.query<RawRowCount>(`
    SELECT
      relname as table_name,
      reltuples::bigint as row_estimate
    FROM pg_class
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND relkind = 'r'
  `);

  // Build constraint maps
  const pkMap = new Set<string>();
  const fkMap = new Set<string>();
  const uniqueMap = new Set<string>();

  for (const c of constraintsResult.rows) {
    const key = `${c.table_name}.${c.column_name}`;
    if (c.constraint_type === "PRIMARY KEY") pkMap.add(key);
    if (c.constraint_type === "FOREIGN KEY") fkMap.add(key);
    if (c.constraint_type === "UNIQUE") uniqueMap.add(key);
  }

  const rowCounts = new Map<string, number>();
  for (const r of rowCountResult.rows) {
    rowCounts.set(r.table_name, Math.max(0, parseInt(r.row_estimate)));
  }

  // Group columns by table
  const tableMap = new Map<string, { schema: string; columns: Column[] }>();

  for (const row of columnsResult.rows) {
    if (!tableMap.has(row.table_name)) {
      tableMap.set(row.table_name, { schema: row.table_schema, columns: [] });
    }
    const key = `${row.table_name}.${row.column_name}`;
    tableMap.get(row.table_name)!.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === "YES",
      columnDefault: row.column_default,
      characterMaxLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      ordinalPosition: row.ordinal_position,
      isPrimaryKey: pkMap.has(key),
      isForeignKey: fkMap.has(key),
      isUnique: uniqueMap.has(key),
    });
  }

  const tables: Table[] = [];
  for (const [name, { schema, columns }] of tableMap) {
    tables.push({
      name,
      schema,
      columns,
      estimatedRowCount: rowCounts.get(name) || 0,
    });
  }

  return tables.sort((a, b) => a.name.localeCompare(b.name));
}
