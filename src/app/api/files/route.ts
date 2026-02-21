import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { paginatedResponse, successResponse, errorResponse, parsePaginationParams } from "@/lib/api-response";
import { DEFAULT_USER_ID, MAX_FILE_SIZE } from "@/lib/constants";
import { ensureUploadDir, deleteFile } from "@/lib/storage";
import { getStoragePath } from "@/lib/constants";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import busboy from "busboy";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const { limit, offset, sortBy, sortOrder } = parsePaginationParams(searchParams);

    const orderByField = sortBy === "createdAt" ? "createdAt" : "name";
    const where = {
      userId: DEFAULT_USER_ID,
      folderId: folderId || null,
    };

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.file.count({ where }),
    ]);

    const serialized = files.map((f) => ({
      ...f,
      size: Number(f.size),
    }));

    return paginatedResponse(serialized, total, limit, offset);
  } catch (error) {
    console.error("GET /api/files error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list files", 500);
  }
}

interface ParsedUpload {
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  folderId: string | null;
}

async function parseMultipartUpload(
  body: ReadableStream<Uint8Array>,
  contentType: string,
  fileId: string
): Promise<ParsedUpload> {
  await ensureUploadDir(DEFAULT_USER_ID);

  return new Promise((resolve, reject) => {
    let fileName: string | null = null;
    let mimeType = "application/octet-stream";
    let folderId: string | null = null;
    let fileSize = 0;
    let storagePath: string | null = null;
    let fileReceived = false;
    let sizeError = false;

    const bb = busboy({ headers: { "content-type": contentType } });

    bb.on("field", (name: string, value: string) => {
      if (name === "folderId" && value) folderId = value;
    });

    bb.on(
      "file",
      (
        name: string,
        stream: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string }
      ) => {
        if (name !== "file" || fileReceived) {
          stream.resume();
          return;
        }
        fileReceived = true;
        fileName = info.filename;
        mimeType = info.mimeType || "application/octet-stream";
        storagePath = getStoragePath(DEFAULT_USER_ID, fileId, info.filename);

        const ws = createWriteStream(storagePath);

        stream.on("data", (chunk: Buffer) => {
          fileSize += chunk.length;
          if (fileSize > MAX_FILE_SIZE) {
            sizeError = true;
            stream.destroy();
            ws.destroy();
          }
        });

        stream.pipe(ws);

        ws.on("close", () => {
          if (sizeError) return;
        });
        ws.on("error", (err) => reject(err));
        stream.on("error", (err) => {
          if (!sizeError) reject(err);
        });
      }
    );

    bb.on("finish", () => {
      if (sizeError) {
        if (storagePath) {
          deleteFile(storagePath).catch(() => {});
        }
        reject(new SizeLimitError());
        return;
      }
      if (!fileName || !storagePath) {
        reject(new MissingFileError());
        return;
      }
      resolve({ fileName, mimeType, fileSize, storagePath, folderId });
    });

    bb.on("error", (err: Error) => reject(err));

    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
    nodeStream.pipe(bb);
  });
}

class SizeLimitError extends Error {
  constructor() {
    super("FILE_TOO_LARGE");
  }
}
class MissingFileError extends Error {
  constructor() {
    super("FILE_MISSING");
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Content-Type must be multipart/form-data",
        400
      );
    }

    if (!request.body) {
      return errorResponse("VALIDATION_ERROR", "Request body is required", 400);
    }

    const fileId = randomUUID();
    let parsed: ParsedUpload;
    try {
      parsed = await parseMultipartUpload(request.body, contentType, fileId);
    } catch (err) {
      if (err instanceof SizeLimitError) {
        return errorResponse(
          "VALIDATION_ERROR",
          `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          400
        );
      }
      if (err instanceof MissingFileError) {
        return errorResponse("VALIDATION_ERROR", "File is required", 400);
      }
      throw err;
    }

    if (parsed.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: parsed.folderId, userId: DEFAULT_USER_ID },
      });
      if (!folder) {
        await deleteFile(parsed.storagePath);
        return errorResponse("NOT_FOUND", "Folder not found", 404);
      }
    }

    const dbFile = await prisma.file.create({
      data: {
        id: fileId,
        name: parsed.fileName,
        mimeType: parsed.mimeType,
        size: parsed.fileSize,
        storagePath: parsed.storagePath,
        folderId: parsed.folderId || null,
        userId: DEFAULT_USER_ID,
      },
    });

    return successResponse(
      { ...dbFile, size: Number(dbFile.size) },
      201
    );
  } catch (error) {
    console.error("POST /api/files error:", error);
    return errorResponse("INTERNAL_ERROR", "Failed to upload file", 500);
  }
}
