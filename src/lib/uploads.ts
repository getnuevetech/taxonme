import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Files are stored outside the public folder and served via an access-checked route.
const UPLOAD_ROOT = path.join(process.cwd(), "var", "uploads");

// Allowlist of accepted MIME types for user-uploaded documents.
// Anything not in this list is rejected before writing to disk.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// Maximum upload size enforced across all upload paths.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 20 MB.`;
  // Normalise the MIME type: client-supplied types are best-effort, but we
  // still reject anything clearly outside the allowlist.
  const mime = (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return `${file.name}: file type "${mime}" is not allowed. Please upload a PDF, image, or Office document.`;
  }
  return null;
}

export async function saveUpload(file: File): Promise<{ filePath: string; sizeBytes: number }> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return { filePath: name, sizeBytes: buf.length };
}

export async function saveUploadBuffer(buf: Buffer, ext: string): Promise<string> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const safeExt = ext.slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${safeExt}`;
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return name;
}

export async function readUpload(filePath: string): Promise<Buffer> {
  // filePath is a generated filename; prevent traversal.
  const safe = path.basename(filePath);
  return fs.readFile(path.join(UPLOAD_ROOT, safe));
}

export async function deleteUpload(filePath: string) {
  const safe = path.basename(filePath);
  await fs.rm(path.join(UPLOAD_ROOT, safe), { force: true });
}
