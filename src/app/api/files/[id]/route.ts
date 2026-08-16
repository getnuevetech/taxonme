import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getGuestSession } from "@/lib/guest";
import { privateFileHeaders, readUpload } from "@/lib/uploads";

// Access-checked file serving: only the owner, their active consultant, or an
// admin can read a stored document.

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
  return new NextResponse(new Uint8Array(buf), {
    headers: privateFileHeaders(doc.fileName, doc.mimeType),
  });
}
