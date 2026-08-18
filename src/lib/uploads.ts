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

function hasSignature(buf: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buf[index] === byte);
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  return !sample.includes(0);
}

function contentMatchesMime(buf: Buffer, mimeType: string): boolean {
  const mime = normalizeMimeType(mimeType);
  if (mime === "application/pdf") return hasSignature(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
  if (mime === "image/jpeg" || mime === "image/jpg") return hasSignature(buf, [0xff, 0xd8, 0xff]);
  if (mime === "image/png") return hasSignature(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/gif") return hasSignature(buf, [0x47, 0x49, 0x46, 0x38]);
  if (mime === "image/webp") return hasSignature(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "image/tiff") return hasSignature(buf, [0x49, 0x49, 0x2a, 0x00]) || hasSignature(buf, [0x4d, 0x4d, 0x00, 0x2a]);
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return hasSignature(buf, [0x50, 0x4b, 0x03, 0x04]);
  }
  if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
    return hasSignature(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (mime === "text/plain" || mime === "text/csv" || mime === "application/csv") return looksLikeText(buf);
  // HEIC/HEIF files are ISO BMFF containers with brand markers not always at
  // byte zero; keep the MIME allowlist as the compatibility gate for those.
  if (mime === "image/heic" || mime === "image/heif") return true;
  return false;
}

export async function saveUpload(file: File): Promise<{ filePath: string; sizeBytes: number; contentHash: string }> {
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 20 MB.`);
  if (!contentMatchesMime(buf, file.type)) {
    throw new Error(`${file.name}: the file content does not match the declared file type.`);
  }
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return { filePath: name, sizeBytes: buf.length, contentHash: crypto.createHash("sha256").update(buf).digest("hex") };
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
