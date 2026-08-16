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
  "text/csv",
  "application/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const INLINE_SAFE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Maximum upload size enforced across all upload paths.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export function normalizeMimeType(mimeType: string): string {
  return (mimeType || "application/octet-stream").split(";")[0].trim().toLowerCase();
}

export function validateUploadFile(file: File): string | null {
  if (file.size <= 0) return `${file.name || "File"} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 20 MB.`;
  // Normalise the MIME type: client-supplied types are best-effort, but we
  // still reject anything clearly outside the allowlist.
  const mime = normalizeMimeType(file.type);
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return `${file.name}: file type "${mime}" is not allowed. Please upload a PDF, image, or Office document.`;
  }
  return null;
}

export function validateImageUploadFile(file: File): string | null {
  const baseError = validateUploadFile(file);
  if (baseError) return baseError;
  const mime = normalizeMimeType(file.type);
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    return `${file.name}: profile pictures must be JPEG, PNG, GIF, WebP, HEIC, or HEIF images.`;
  }
  return null;
}

export async function saveUpload(file: File): Promise<{ filePath: string; sizeBytes: number }> {
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 20 MB.`);
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

export function safeStoredContentType(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  return ALLOWED_MIME_TYPES.has(normalized) ? normalized : "application/octet-stream";
}

export function safeAttachmentFilename(fileName: string): string {
  const cleaned = fileName.replace(/[^\w.\- ]/g, "_").trim().slice(0, 180);
  return cleaned || "download";
}

export function privateFileHeaders(fileName: string, mimeType: string): HeadersInit {
  const contentType = safeStoredContentType(mimeType);
  const disposition = INLINE_SAFE_MIME_TYPES.has(contentType) ? "inline" : "attachment";
  return {
    "Content-Type": contentType,
    "Content-Disposition": `${disposition}; filename="${safeAttachmentFilename(fileName)}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
