import { Pool } from "pg";
import type { EnumType } from "./types";

interface RawEnum {
  enum_name: string;
  enum_schema: string;
  enum_value: string;
  sort_order: number;
}

export async function extractEnums(pool: Pool): Promise<EnumType[]> {
  const result = await pool.query<RawEnum>(`
    SELECT
      t.typname AS enum_name,
      n.nspname AS enum_schema,
      e.enumlabel AS enum_value,
      e.enumsortorder AS sort_order
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);

  const enumMap = new Map<string, EnumType>();

  for (const row of result.rows) {
    if (!enumMap.has(row.enum_name)) {
      enumMap.set(row.enum_name, {
        name: row.enum_name,
        schema: row.enum_schema,
        values: [],
      });
    }
    enumMap.get(row.enum_name)!.values.push(row.enum_value);
  }

  return Array.from(enumMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
