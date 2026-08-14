import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getGuestSession } from "@/lib/guest";
import { readUpload, ALLOWED_MIME_TYPES } from "@/lib/uploads";

// Access-checked file serving: only the owner, their active consultant, or an
// admin can read a stored document.

// Map allowed MIME types to the Content-Type the browser should receive.
// Types not in this map are served as application/octet-stream (forced download).
// Defined at module scope so it is allocated once, not on every request.
const INLINE_SAFE_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

function safeContentType(mimeType: string): string {
  const normalized = (mimeType || "application/octet-stream").split(";")[0].trim().toLowerCase();
  // Only serve a recognized MIME type; anything not in the upload allowlist falls back to octet-stream.
  return ALLOWED_MIME_TYPES.has(normalized) ? normalized : "application/octet-stream";
}

// Access-checked file serving: only the owner, their active consultant, or an
// admin can read a stored document.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) return new NextResponse("Not found", { status: 404 });

  const user = await getCurrentUser();
  let allowed = false;
  if (user) {
    if (doc.userId === user.id || isAdmin(user)) allowed = true;
    else if (doc.userId) {
      const assignment = await db.consultantAssignment.findFirst({
        where: { consultantId: user.id, userId: doc.userId, status: "active" },
      });
      allowed = !!assignment;
    }
  } else if (doc.guestSessionId) {
    const guest = await getGuestSession();
    allowed = !!guest && guest.id === doc.guestSessionId;
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const buf = await readUpload(doc.filePath);
  const contentType = safeContentType(doc.mimeType);
  // Serve PDFs and images inline; force download for everything else.
  const disposition = INLINE_SAFE_TYPES.has(contentType) ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
    },
  });
}
