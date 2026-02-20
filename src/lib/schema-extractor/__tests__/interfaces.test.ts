import { inferInterfaces } from "../interfaces";
import type { Table, Relationship, EnumType } from "../types";

const sampleTables: Table[] = [
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
        columnDefault: "gen_random_uuid()",
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 1,
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: false,
      },
      {
        name: "email",
        dataType: "character varying",
        udtName: "varchar",
        isNullable: false,
        columnDefault: null,
        characterMaxLength: 255,
        numericPrecision: null,
        ordinalPosition: 2,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: true,
      },
      {
        name: "status",
        dataType: "USER-DEFINED",
        udtName: "user_status",
        isNullable: false,
        columnDefault: "'active'",
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 3,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
      {
        name: "age",
        dataType: "integer",
        udtName: "int4",
        isNullable: true,
        columnDefault: null,
        characterMaxLength: null,
        numericPrecision: 32,
        ordinalPosition: 4,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
      {
        name: "metadata",
        dataType: "jsonb",
        udtName: "jsonb",
        isNullable: true,
        columnDefault: null,
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 5,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
      {
        name: "tags",
        dataType: "ARRAY",
        udtName: "_text",
        isNullable: true,
        columnDefault: null,
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 6,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
    ],
  },
  {
    name: "posts",
    schema: "public",
    estimatedRowCount: 500,
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
        name: "user_id",
        dataType: "uuid",
        udtName: "uuid",
        isNullable: false,
        columnDefault: null,
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 2,
        isPrimaryKey: false,
        isForeignKey: true,
        isUnique: false,
      },
      {
        name: "is_published",
        dataType: "boolean",
        udtName: "bool",
        isNullable: false,
        columnDefault: "false",
        characterMaxLength: null,
        numericPrecision: null,
        ordinalPosition: 3,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
      },
    ],
  },
];

const sampleRelationships: Relationship[] = [
  {
    constraintName: "fk_posts_user",
    sourceTable: "posts",
    sourceColumn: "user_id",
    targetTable: "users",
    targetColumn: "id",
    updateRule: "NO ACTION",
    deleteRule: "CASCADE",
  },
];

const sampleEnums: EnumType[] = [
  {
    name: "user_status",
    schema: "public",
    values: ["active", "inactive", "banned"],
  },
];

describe("inferInterfaces", () => {
  it("should generate interfaces for all tables", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);

    expect(interfaces).toHaveLength(2);
    expect(interfaces[0].name).toBe("Users");
    expect(interfaces[1].name).toBe("Posts");
  });

  it("should map PG types to TypeScript types correctly", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);
    const usersInterface = interfaces.find((i) => i.name === "Users")!;

    const idProp = usersInterface.properties.find((p) => p.name === "id")!;
    expect(idProp.type).toBe("string"); // uuid -> string

    const emailProp = usersInterface.properties.find((p) => p.name === "email")!;
    expect(emailProp.type).toBe("string"); // varchar -> string

    const ageProp = usersInterface.properties.find((p) => p.name === "age")!;
    expect(ageProp.type).toBe("number"); // int4 -> number
    expect(ageProp.isOptional).toBe(true); // nullable

    const metadataProp = usersInterface.properties.find((p) => p.name === "metadata")!;
    expect(metadataProp.type).toBe("Record<string, unknown>"); // jsonb

    const tagsProp = usersInterface.properties.find((p) => p.name === "tags")!;
    expect(tagsProp.type).toBe("string[]"); // _text -> string[]
    expect(tagsProp.isArray).toBe(true);
  });

  it("should map enums to PascalCase type names", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);
    const usersInterface = interfaces.find((i) => i.name === "Users")!;

    const statusProp = usersInterface.properties.find((p) => p.name === "status")!;
    expect(statusProp.type).toBe("UserStatus");
  });

  it("should add relation properties for foreign keys", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);
    const postsInterface = interfaces.find((i) => i.name === "Posts")!;

    // Should have the FK column + the relation object
    const userIdProp = postsInterface.properties.find((p) => p.name === "userId")!;
    expect(userIdProp).toBeDefined();

    const userRelation = postsInterface.properties.find((p) => p.name === "users")!;
    expect(userRelation).toBeDefined();
    expect(userRelation.type).toBe("Users");
  });

  it("should add reverse relation arrays", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);
    const usersInterface = interfaces.find((i) => i.name === "Users")!;

    const postsArray = usersInterface.properties.find((p) => p.name === "postss");
    // The reverse relation should exist (posts -> users creates a postss array on Users)
    expect(postsArray).toBeDefined();
    expect(postsArray!.isArray).toBe(true);
    expect(postsArray!.type).toBe("Posts");
  });

  it("should mark PK fields as not optional even when nullable info says otherwise", () => {
    const interfaces = inferInterfaces(sampleTables, sampleRelationships, sampleEnums);
    const usersInterface = interfaces.find((i) => i.name === "Users")!;

    const idProp = usersInterface.properties.find((p) => p.name === "id")!;
    expect(idProp.isOptional).toBe(false);
  });
});
