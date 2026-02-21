import fs from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "./constants";

export async function ensureUploadDir(userId: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveFile(
  userId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  await ensureUploadDir(userId);
  const storagePath = path.join(UPLOAD_DIR, userId, `${fileId}-${fileName}`);
  await fs.writeFile(storagePath, buffer);
  return storagePath;
}

export async function deleteFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(storagePath);
  } catch {
    // Ignore if already deleted
  }
}

export async function readFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(storagePath);
}

export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    await fs.access(storagePath);
    return true;
  } catch {
    return false;
  }
}
