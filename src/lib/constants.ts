import path from "path";

export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export const MAX_FILE_SIZE =
  (parseInt(process.env.MAX_FILE_SIZE_MB || "100", 10)) * 1024 * 1024;

export function getStoragePath(userId: string, fileId: string, fileName: string): string {
  return path.join(UPLOAD_DIR, userId, `${fileId}-${fileName}`);
}
