import { createMockPrisma, createMockRequest, sampleFolder } from "@/test/helpers";

const mockPrisma = createMockPrisma();
jest.mock("@/lib/db", () => ({ prisma: mockPrisma }));

jest.mock("@/lib/storage", () => ({
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

import { GET, PATCH, DELETE } from "../[id]/route";

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/folders/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return folder with children and files", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue({
      ...sampleFolder,
      children: [],
      files: [],
    });

    const req = createMockRequest("GET");
    const res = await GET(req as any, makeContext(sampleFolder.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Test Folder");
  });

  it("should return 404 for non-existent folder", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(null);

    const req = createMockRequest("GET");
    const res = await GET(req as any, makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/folders/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should rename a folder", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(sampleFolder);
    mockPrisma.folder.update.mockResolvedValue({
      ...sampleFolder,
      name: "Renamed",
    });

    const req = createMockRequest("PATCH", { body: { name: "Renamed" } });
    const res = await PATCH(req as any, makeContext(sampleFolder.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Renamed");
  });

  it("should reject empty name", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(sampleFolder);

    const req = createMockRequest("PATCH", { body: { name: "" } });
    const res = await PATCH(req as any, makeContext(sampleFolder.id));

    expect(res.status).toBe(400);
  });

  it("should reject moving folder into itself", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(sampleFolder);

    const req = createMockRequest("PATCH", {
      body: { parentId: sampleFolder.id },
    });
    const res = await PATCH(req as any, makeContext(sampleFolder.id));

    expect(res.status).toBe(409);
  });

  it("should move folder to new parent", async () => {
    const targetId = "t0000000-0000-0000-0000-000000000001";
    mockPrisma.folder.findFirst
      .mockResolvedValueOnce(sampleFolder) // Find the folder
      .mockResolvedValueOnce({ id: targetId }); // Find the target
    mockPrisma.$queryRaw.mockResolvedValue([]); // No circular ref
    mockPrisma.folder.update.mockResolvedValue({
      ...sampleFolder,
      parentId: targetId,
    });

    const req = createMockRequest("PATCH", { body: { parentId: targetId } });
    const res = await PATCH(req as any, makeContext(sampleFolder.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.parentId).toBe(targetId);
  });

  it("should reject circular reference", async () => {
    const targetId = "t0000000-0000-0000-0000-000000000001";
    mockPrisma.folder.findFirst
      .mockResolvedValueOnce(sampleFolder)
      .mockResolvedValueOnce({ id: targetId });
    // Circular: the folder appears in target's ancestor chain
    mockPrisma.$queryRaw.mockResolvedValue([{ id: sampleFolder.id }]);

    const req = createMockRequest("PATCH", { body: { parentId: targetId } });
    const res = await PATCH(req as any, makeContext(sampleFolder.id));

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/folders/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should delete folder and descendant files", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(sampleFolder);
    mockPrisma.$queryRaw.mockResolvedValue([
      { storage_path: "/some/path.txt" },
    ]);
    mockPrisma.folder.delete.mockResolvedValue(sampleFolder);

    const req = createMockRequest("DELETE");
    const res = await DELETE(req as any, makeContext(sampleFolder.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("should return 404 for non-existent folder", async () => {
    mockPrisma.folder.findFirst.mockResolvedValue(null);

    const req = createMockRequest("DELETE");
    const res = await DELETE(req as any, makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });
});
