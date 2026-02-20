import { buildSchemaSummary, validateSQLSafety } from "../text-to-sql";
import type { ExtractedSchema } from "../../schema-extractor/types";

const mockSchema: ExtractedSchema = {
  tables: [
    {
      name: "users",
      schema: "public",
      estimatedRowCount: 100,
      columns: [
        {
          name: "id",
          dataType: "uuid",
          udtName: "uuid",
          isNullable: false,
          columnDefault: null,
          characterMaxLength: null,
          numericPrecision: null,
          ordinalPosition: 1,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: false,
        },
        {
          name: "name",
          dataType: "character varying",
          udtName: "varchar",
          isNullable: true,
          columnDefault: null,
          characterMaxLength: 255,
          numericPrecision: null,
          ordinalPosition: 2,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
        },
      ],
    },
  ],
  relationships: [
    {
      constraintName: "fk_posts_user",
      sourceTable: "posts",
      sourceColumn: "user_id",
      targetTable: "users",
      targetColumn: "id",
      updateRule: "NO ACTION",
      deleteRule: "CASCADE",
    },
  ],
  enums: [
    {
      name: "status",
      schema: "public",
      values: ["active", "inactive"],
    },
  ],
  indexes: [],
  interfaces: [],
  extractedAt: "2024-01-01T00:00:00.000Z",
};

describe("buildSchemaSummary", () => {
  it("should produce table, enum, and relationship summary", () => {
    const summary = buildSchemaSummary(mockSchema);

    expect(summary).toContain("TABLE users:");
    expect(summary).toContain("id uuid [PK, NOT NULL]");
    expect(summary).toContain("name varchar");
    expect(summary).toContain("ENUMS:");
    expect(summary).toContain("status: active, inactive");
    expect(summary).toContain("RELATIONSHIPS:");
    expect(summary).toContain("posts.user_id -> users.id");
  });

  it("should omit sections when empty", () => {
    const emptySchema: ExtractedSchema = {
      tables: [],
      relationships: [],
      enums: [],
      indexes: [],
      interfaces: [],
      extractedAt: "2024-01-01",
    };
    const summary = buildSchemaSummary(emptySchema);

    expect(summary).toBe("");
    expect(summary).not.toContain("ENUMS:");
    expect(summary).not.toContain("RELATIONSHIPS:");
  });
});

describe("validateSQLSafety", () => {
  it("should allow SELECT queries", () => {
    expect(validateSQLSafety("SELECT * FROM users")).toEqual({ safe: true });
    expect(
      validateSQLSafety("SELECT u.name, COUNT(*) FROM users u GROUP BY u.name")
    ).toEqual({ safe: true });
  });

  it("should reject INSERT", () => {
    const result = validateSQLSafety("INSERT INTO users (name) VALUES ('test')");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("INSERT");
  });

  it("should reject UPDATE", () => {
    const result = validateSQLSafety("UPDATE users SET name = 'test'");
    expect(result.safe).toBe(false);
  });

  it("should reject DELETE", () => {
    const result = validateSQLSafety("DELETE FROM users WHERE id = 1");
    expect(result.safe).toBe(false);
  });

  it("should reject DROP", () => {
    const result = validateSQLSafety("DROP TABLE users");
    expect(result.safe).toBe(false);
  });

  it("should reject ALTER", () => {
    const result = validateSQLSafety("ALTER TABLE users ADD COLUMN age INT");
    expect(result.safe).toBe(false);
  });

  it("should reject TRUNCATE", () => {
    const result = validateSQLSafety("TRUNCATE users");
    expect(result.safe).toBe(false);
  });

  it("should reject case-insensitive mutations", () => {
    expect(validateSQLSafety("insert into users values (1)").safe).toBe(false);
    expect(validateSQLSafety("Drop Table users").safe).toBe(false);
  });

  it("should allow SELECT with subqueries", () => {
    expect(
      validateSQLSafety(
        "SELECT * FROM users WHERE id IN (SELECT user_id FROM posts)"
      )
    ).toEqual({ safe: true });
  });
});
