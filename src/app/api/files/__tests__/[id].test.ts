import { createMockPrisma, createMockRequest, sampleFile } from "@/test/helpers";

const mockPrisma = createMockPrisma();
jest.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const mockReadFile = jest.fn();
const mockDeleteFile = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/storage", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}));

import { GET, PATCH, DELETE } from "../[id]/route";

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/files/[id] (download)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should download a file", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);
    mockReadFile.mockResolvedValue(Buffer.from("hello world"));

    const req = createMockRequest("GET");
    const res = await GET(req as any, makeContext(sampleFile.id));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("should return 404 for non-existent file", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(null);

    const req = createMockRequest("GET");
    const res = await GET(req as any, makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/files/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should rename a file", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);
    mockPrisma.file.update.mockResolvedValue({
      ...sampleFile,
      name: "renamed.txt",
    });

    const req = createMockRequest("PATCH", { body: { name: "renamed.txt" } });
    const res = await PATCH(req as any, makeContext(sampleFile.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("renamed.txt");
  });

  it("should move file to folder", async () => {
    const folderId = "f0000000-0000-0000-0000-000000000001";
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);
    mockPrisma.folder.findFirst.mockResolvedValue({ id: folderId });
    mockPrisma.file.update.mockResolvedValue({
      ...sampleFile,
      folderId,
    });

    const req = createMockRequest("PATCH", { body: { folderId } });
    const res = await PATCH(req as any, makeContext(sampleFile.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.folderId).toBe(folderId);
  });

  it("should reject empty name", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);

    const req = createMockRequest("PATCH", { body: { name: "" } });
    const res = await PATCH(req as any, makeContext(sampleFile.id));

    expect(res.status).toBe(400);
  });

  it("should reject non-existent target folder", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);
    mockPrisma.folder.findFirst.mockResolvedValue(null);

    const req = createMockRequest("PATCH", { body: { folderId: "bad" } });
    const res = await PATCH(req as any, makeContext(sampleFile.id));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/files/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should delete file from disk and DB", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(sampleFile);
    mockPrisma.file.delete.mockResolvedValue(sampleFile);

    const req = createMockRequest("DELETE");
    const res = await DELETE(req as any, makeContext(sampleFile.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith(sampleFile.storagePath);
  });

  it("should return 404 for non-existent file", async () => {
    mockPrisma.file.findFirst.mockResolvedValue(null);

    const req = createMockRequest("DELETE");
    const res = await DELETE(req as any, makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });
});
