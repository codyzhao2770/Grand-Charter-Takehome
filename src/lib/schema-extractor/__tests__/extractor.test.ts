import { createMockPool } from "@/test/helpers";

// Mock pg module
jest.mock("pg", () => {
  return {
    Pool: jest.fn(),
  };
});

import { extractTables } from "../tables";
import { extractRelationships } from "../relationships";
import { extractEnums } from "../enums";
import { extractIndexes } from "../indexes";
import type { Pool } from "pg";

describe("extractTables", () => {
  it("should extract tables with columns and row counts", async () => {
    const { pool } = createMockPool();
    pool.query
      .mockResolvedValueOnce({
        // columns query
        rows: [
          {
            table_name: "users",
            table_schema: "public",
            column_name: "id",
            data_type: "uuid",
            udt_name: "uuid",
            is_nullable: "NO",
            column_default: "gen_random_uuid()",
            character_maximum_length: null,
            numeric_precision: null,
            ordinal_position: 1,
          },
          {
            table_name: "users",
            table_schema: "public",
            column_name: "email",
            data_type: "character varying",
            udt_name: "varchar",
            is_nullable: "NO",
            column_default: null,
            character_maximum_length: 255,
            numeric_precision: null,
            ordinal_position: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        // constraints query
        rows: [
          { table_name: "users", column_name: "id", constraint_type: "PRIMARY KEY" },
          { table_name: "users", column_name: "email", constraint_type: "UNIQUE" },
        ],
      })
      .mockResolvedValueOnce({
        // row count query
        rows: [{ table_name: "users", row_estimate: "1000" }],
      });

    const tables = await extractTables(pool as unknown as Pool);

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(tables[0].columns[1].isUnique).toBe(true);
    expect(tables[0].estimatedRowCount).toBe(1000);
  });

  it("should return empty array for empty schema", async () => {
    const { pool } = createMockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const tables = await extractTables(pool as unknown as Pool);
    expect(tables).toHaveLength(0);
  });
});

describe("extractRelationships", () => {
  it("should extract foreign key relationships", async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          constraint_name: "fk_posts_user",
          source_table: "posts",
          source_column: "user_id",
          target_table: "users",
          target_column: "id",
          update_rule: "NO ACTION",
          delete_rule: "CASCADE",
        },
      ],
    });

    const rels = await extractRelationships(pool as unknown as Pool);

    expect(rels).toHaveLength(1);
    expect(rels[0].sourceTable).toBe("posts");
    expect(rels[0].targetTable).toBe("users");
    expect(rels[0].deleteRule).toBe("CASCADE");
  });
});

describe("extractEnums", () => {
  it("should extract enum types with values", async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { enum_name: "status", enum_schema: "public", enum_value: "active", sort_order: 1 },
        { enum_name: "status", enum_schema: "public", enum_value: "inactive", sort_order: 2 },
        { enum_name: "role", enum_schema: "public", enum_value: "admin", sort_order: 1 },
        { enum_name: "role", enum_schema: "public", enum_value: "user", sort_order: 2 },
      ],
    });

    const enums = await extractEnums(pool as unknown as Pool);

    expect(enums).toHaveLength(2);
    const roleEnum = enums.find((e) => e.name === "role")!;
    expect(roleEnum.values).toEqual(["admin", "user"]);
    const statusEnum = enums.find((e) => e.name === "status")!;
    expect(statusEnum.values).toEqual(["active", "inactive"]);
  });
});

describe("extractIndexes", () => {
  it("should extract indexes with columns", async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          index_name: "users_pkey",
          table_name: "users",
          column_name: "id",
          is_unique: true,
          is_primary: true,
          index_type: "btree",
        },
        {
          index_name: "idx_users_email",
          table_name: "users",
          column_name: "email",
          is_unique: true,
          is_primary: false,
          index_type: "btree",
        },
      ],
    });

    const indexes = await extractIndexes(pool as unknown as Pool);

    expect(indexes).toHaveLength(2);
    const pkey = indexes.find((i) => i.name === "users_pkey")!;
    expect(pkey.isPrimary).toBe(true);
    expect(pkey.columns).toEqual(["id"]);
  });
});
