import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-response";
import { readFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!shareLink) {
      return errorResponse("NOT_FOUND", "Share link not found", 404);
    }

    if (shareLink.expiresAt < new Date()) {
      return errorResponse("GONE", "Share link has expired", 410);
    }

    const buffer = await readFile(shareLink.file.storagePath);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": shareLink.file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(shareLink.file.name)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/shares/[token] error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to serve shared file", 500);
  }
}
