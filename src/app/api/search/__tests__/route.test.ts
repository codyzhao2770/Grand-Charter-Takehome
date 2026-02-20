import { createMockPrisma, createMockRequest, sampleFile, sampleFolder } from "@/test/helpers";

const mockPrisma = createMockPrisma();
jest.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "../route";

describe("GET /api/search", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return matching files and folders", async () => {
    mockPrisma.file.findMany.mockResolvedValue([sampleFile]);
    mockPrisma.folder.findMany.mockResolvedValue([sampleFolder]);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const req = createMockRequest("GET", { searchParams: { q: "test" } });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.files).toHaveLength(1);
    expect(body.data.folders).toHaveLength(1);
    expect(body.data.files[0].type).toBe("file");
    expect(body.data.folders[0].type).toBe("folder");
  });

  it("should reject empty query", async () => {
    const req = createMockRequest("GET", { searchParams: { q: "" } });
    const res = await GET(req as any);

    expect(res.status).toBe(400);
  });

  it("should reject missing query", async () => {
    const req = createMockRequest("GET");
    const res = await GET(req as any);

    expect(res.status).toBe(400);
  });
});
