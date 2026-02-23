import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_EXPIRES_DAYS = 30;
const DEFAULT_EXPIRES_DAYS = 7;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    let expiresInDays = DEFAULT_EXPIRES_DAYS;
    try {
      const body = await request.json();
      if (typeof body.expiresInDays === "number") {
        expiresInDays = Math.max(1, Math.min(body.expiresInDays, MAX_EXPIRES_DAYS));
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const shareLink = await prisma.shareLink.create({
      data: {
        token,
        fileId: id,
        userId: DEFAULT_USER_ID,
        expiresAt,
      },
    });

    const origin = request.nextUrl.origin;
    const url = `${origin}/api/shares/${token}`;

    return successResponse({
      id: shareLink.id,
      token: shareLink.token,
      url,
      previewUrl: `${url}/preview`,
      expiresAt: shareLink.expiresAt.toISOString(),
      createdAt: shareLink.createdAt.toISOString(),
    }, 201);
  } catch (error) {
    console.error("POST /api/files/[id]/share error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create share link", 500);
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    const links = await prisma.shareLink.findMany({
      where: {
        fileId: id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(
      links.map((l) => ({
        id: l.id,
        token: l.token,
        expiresAt: l.expiresAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("GET /api/files/[id]/share error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list share links", 500);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });
    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    const result = await prisma.shareLink.deleteMany({
      where: { fileId: id },
    });

    return successResponse({ revoked: result.count });
  } catch (error) {
    console.error("DELETE /api/files/[id]/share error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to revoke share links", 500);
  }
}
