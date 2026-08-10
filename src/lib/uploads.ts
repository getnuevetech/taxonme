import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Files are stored outside the public folder and served via an access-checked route.
const UPLOAD_ROOT = path.join(process.cwd(), "var", "uploads");

export async function saveUpload(file: File): Promise<{ filePath: string; sizeBytes: number }> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return { filePath: name, sizeBytes: buf.length };
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
