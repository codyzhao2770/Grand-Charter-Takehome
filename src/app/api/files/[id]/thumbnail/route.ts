import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/api-response";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { readFile } from "@/lib/storage";
import sharp from "sharp";

const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 400;

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const file = await prisma.file.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
    });

    if (!file) {
      return errorResponse("NOT_FOUND", "File not found", 404);
    }

    if (!SUPPORTED_TYPES.has(file.mimeType)) {
      return errorResponse(
        "UNSUPPORTED",
        "Thumbnail not available for this file type",
        415
      );
    }

    const buffer = await readFile(file.storagePath);

    const thumbnail = await sharp(buffer)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, {
        fit: "cover",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    return new Response(new Uint8Array(thumbnail), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": thumbnail.length.toString(),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/files/[id]/thumbnail error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to generate thumbnail", 500);
  }
}
