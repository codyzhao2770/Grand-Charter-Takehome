import type {
  Table,
  Relationship,
  EnumType,
  InferredInterface,
  InterfaceProperty,
} from "./types";

const PG_TO_TS_TYPE: Record<string, string> = {
  // Numeric
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  serial: "number",
  bigserial: "number",
  smallserial: "number",
  // String
  varchar: "string",
  text: "string",
  char: "string",
  bpchar: "string",
  name: "string",
  citext: "string",
  // Boolean
  bool: "boolean",
  // Date/Time
  timestamp: "Date",
  timestamptz: "Date",
  date: "Date",
  time: "string",
  timetz: "string",
  interval: "string",
  // JSON
  json: "Record<string, unknown>",
  jsonb: "Record<string, unknown>",
  // UUID
  uuid: "string",
  // Binary
  bytea: "Buffer",
  // Array types handled separately
};

function pgTypeToTs(udtName: string, enumNames: Set<string>): string {
  // Check if it's an array type (PG prefixes with _)
  if (udtName.startsWith("_")) {
    const baseType = udtName.slice(1);
    const tsType = PG_TO_TS_TYPE[baseType] || (enumNames.has(baseType) ? pascalCase(baseType) : "unknown");
    return `${tsType}[]`;
  }

  // Check if it's an enum
  if (enumNames.has(udtName)) {
    return pascalCase(udtName);
  }

  return PG_TO_TS_TYPE[udtName] || "unknown";
}

function pascalCase(str: string): string {
  return str
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function inferInterfaces(
  tables: Table[],
  relationships: Relationship[],
  enums: EnumType[]
): InferredInterface[] {
  const enumNames = new Set(enums.map((e) => e.name));

  // Build a map of FK relationships: sourceTable.sourceColumn -> targetTable
  const fkTargets = new Map<string, { targetTable: string; targetColumn: string }>();
  for (const rel of relationships) {
    fkTargets.set(`${rel.sourceTable}.${rel.sourceColumn}`, {
      targetTable: rel.targetTable,
      targetColumn: rel.targetColumn,
    });
  }

  // Build reverse relationships: targetTable -> sourceTable[]
  const reverseRels = new Map<string, { sourceTable: string; sourceColumn: string }[]>();
  for (const rel of relationships) {
    if (!reverseRels.has(rel.targetTable)) {
      reverseRels.set(rel.targetTable, []);
    }
    reverseRels.get(rel.targetTable)!.push({
      sourceTable: rel.sourceTable,
      sourceColumn: rel.sourceColumn,
    });
  }

  return tables.map((table) => {
    const properties: InterfaceProperty[] = [];

    // Column properties
    for (const col of table.columns) {
      const fkTarget = fkTargets.get(`${table.name}.${col.name}`);

      properties.push({
        name: camelCase(col.name),
        type: pgTypeToTs(col.udtName, enumNames),
        isOptional: col.isNullable && !col.isPrimaryKey,
        isArray: col.udtName.startsWith("_"),
      });

      // Add relation property for FK columns
      if (fkTarget) {
        properties.push({
          name: camelCase(fkTarget.targetTable),
          type: pascalCase(fkTarget.targetTable),
          isOptional: col.isNullable,
          isArray: false,
          description: `Relation to ${fkTarget.targetTable}`,
        });
      }
    }

    // Add reverse relation arrays
    const reverses = reverseRels.get(table.name) || [];
    for (const rev of reverses) {
      const propName = camelCase(rev.sourceTable) + "s";
      // Avoid duplicates
      if (!properties.find((p) => p.name === propName)) {
        properties.push({
          name: propName,
          type: pascalCase(rev.sourceTable),
          isOptional: true,
          isArray: true,
          description: `Reverse relation from ${rev.sourceTable}.${rev.sourceColumn}`,
        });
      }
    }

    // Collect associated tables (FK targets + reverse sources)
    const associated = new Set<string>();
    for (const col of table.columns) {
      const fkTarget = fkTargets.get(`${table.name}.${col.name}`);
      if (fkTarget) associated.add(fkTarget.targetTable);
    }
    for (const rev of reverses) {
      associated.add(rev.sourceTable);
    }
    associated.delete(table.name);

    return {
      name: pascalCase(table.name),
      tableName: table.name,
      properties,
      associatedTables: [...associated],
    };
  });
}
