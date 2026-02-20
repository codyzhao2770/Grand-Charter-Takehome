/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Create a mock Prisma client with jest.fn() for all methods we use.
 */
export function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    dbConnection: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
}

/**
 * Build a NextRequest-like object for testing route handlers.
 */
export function createMockRequest(
  method: string,
  options: {
    body?: any;
    searchParams?: Record<string, string>;
    formData?: FormData;
  } = {}
): Request {
  const url = new URL("http://localhost:3000/api/test");
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const init: RequestInit = { method };

  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }

  if (options.formData) {
    init.body = options.formData;
  }

  return new Request(url.toString(), init);
}

/**
 * Helper to build a mock pg Pool.
 */
export function createMockPool(queryResults: Record<string, any> = {}) {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const pool = {
    query: jest.fn().mockImplementation((sql: string) => {
      // Match based on a key substring from the SQL
      for (const [key, result] of Object.entries(queryResults)) {
        if (sql.includes(key)) {
          return Promise.resolve(result);
        }
      }
      return Promise.resolve({ rows: [], fields: [] });
    }),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
  };

  return { pool, mockClient };
}

/**
 * Sample folder data for tests.
 */
export const sampleFolder = {
  id: "f0000000-0000-0000-0000-000000000001",
  name: "Test Folder",
  parentId: null,
  userId: "00000000-0000-0000-0000-000000000000",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/**
 * Sample file data for tests.
 */
export const sampleFile = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "test.txt",
  mimeType: "text/plain",
  size: BigInt(100),
  storagePath: "./uploads/00000000-0000-0000-0000-000000000000/a0000000-0000-0000-0000-000000000001-test.txt",
  folderId: null,
  userId: "00000000-0000-0000-0000-000000000000",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};
