export interface Column {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaxLength: number | null;
  numericPrecision: number | null;
  ordinalPosition: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
}

export interface Table {
  name: string;
  schema: string;
  columns: Column[];
  estimatedRowCount: number;
}

export interface Relationship {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  updateRule: string;
  deleteRule: string;
}

export interface EnumType {
  name: string;
  schema: string;
  values: string[];
}

export interface Index {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType: string;
}

export interface InterfaceProperty {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  description?: string;
}

export interface InferredInterface {
  name: string;
  tableName: string;
  properties: InterfaceProperty[];
  associatedTables: string[];
}

export interface ExtractedSchema {
  tables: Table[];
  relationships: Relationship[];
  enums: EnumType[];
  indexes: Index[];
  interfaces: InferredInterface[];
  extractedAt: string;
}
