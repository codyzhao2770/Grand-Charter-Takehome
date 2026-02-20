import { createMockPrisma, createMockRequest, sampleFolder } from "@/test/helpers";

// Mock prisma
const mockPrisma = createMockPrisma();
jest.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "../route";

describe("GET /api/folders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should list root folders when no parentId", async () => {
    mockPrisma.folder.findMany.mockResolvedValue([
      { ...sampleFolder, _count: { children: 2, files: 3 } },
    ]);

    const req = createMockRequest("GET");
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Test Folder");
    expect(mockPrisma.folder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
      })
    );
  });

  it("should list folders by parentId", async () => {
    mockPrisma.folder.findMany.mockResolvedValue([]);

    const req = createMockRequest("GET", {
      searchParams: { parentId: sampleFolder.id },
    });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(mockPrisma.folder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: sampleFolder.id }),
      })
    );
  });
});

describe("POST /api/folders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create a folder", async () => {
    mockPrisma.folder.create.mockResolvedValue(sampleFolder);

    const req = createMockRequest("POST", { body: { name: "Test Folder" } });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.name).toBe("Test Folder");
  });

  it("should reject empty name", async () => {
    const req = createMockRequest("POST", { body: { name: "" } });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject missing name", async () => {
    const req = createMockRequest("POST", { body: {} });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("should create folder with parentId", async () => {
    const parent = { ...sampleFolder, id: "parent-id" };
    mockPrisma.folder.findFirst.mockResolvedValue(parent);
    mockPrisma.folder.create.mockResolvedValue({
      ...sampleFolder,
      parentId: parent.id,
    });

    const req = createMockRequest("POST", {
      body: { name: "Child Folder", parentId: parent.id },
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.parentId).toBe(parent.id);
  });

  it("should reject non-existent parentId", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(null);

    const req = createMockRequest("POST", {
      body: { name: "Child", parentId: "nonexistent" },
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
