import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getGuestSession } from "@/lib/guest";
import { readUpload } from "@/lib/uploads";

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

  // Normalize Content-Type to a known-safe set to prevent stored-XSS via a
  // user-supplied file.type that the browser might execute inline (e.g. text/html).
  const SAFE_TYPES: Record<string, string> = {
    "application/pdf": "application/pdf",
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "text/plain": "text/plain",
  };
  const contentType = SAFE_TYPES[doc.mimeType] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      // Force download for every MIME type that is not an image or PDF so the
      // browser never renders potentially dangerous content inline.
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
    },
  });
}
