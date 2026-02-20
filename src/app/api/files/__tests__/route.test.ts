import { createMockPrisma, createMockRequest, sampleFile } from "@/test/helpers";

const mockPrisma = createMockPrisma();
jest.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const mockSaveFile = jest.fn().mockResolvedValue("/uploads/test/path");
jest.mock("@/lib/storage", () => ({
  saveFile: (...args: unknown[]) => mockSaveFile(...args),
}));

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: () => "a0000000-0000-0000-0000-000000000001",
}));

import { GET, POST } from "../route";

describe("GET /api/files", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should list root files when no folderId", async () => {
    mockPrisma.file.findMany.mockResolvedValue([
      { ...sampleFile, size: BigInt(100) },
    ]);

    const req = createMockRequest("GET");
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("test.txt");
    expect(typeof body.data[0].size).toBe("number");
  });

  it("should list files by folderId", async () => {
    mockPrisma.file.findMany.mockResolvedValue([]);

    const req = createMockRequest("GET", {
      searchParams: { folderId: "some-folder-id" },
    });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });
});

describe("POST /api/files", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should upload a file", async () => {
    const fileBlob = new File(["hello world"], "test.txt", {
      type: "text/plain",
    });
    const formData = new FormData();
    formData.append("file", fileBlob);

    mockPrisma.file.create.mockResolvedValue({
      ...sampleFile,
      id: "a0000000-0000-0000-0000-000000000001",
    });

    const req = new Request("http://localhost:3000/api/files", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.name).toBe("test.txt");
    expect(mockSaveFile).toHaveBeenCalled();
  });

  it("should reject request without file", async () => {
    const formData = new FormData();

    const req = new Request("http://localhost:3000/api/files", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("should reject file in non-existent folder", async () => {
    const fileBlob = new File(["hello"], "test.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", fileBlob);
    formData.append("folderId", "nonexistent");

    mockPrisma.folder.findFirst.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/files", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(404);
  });
});
