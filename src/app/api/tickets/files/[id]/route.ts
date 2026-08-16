import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { privateFileHeaders, readUpload } from "@/lib/uploads";

// Ticket attachments: visible to the ticket owner and support staff only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await db.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { userId: true } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const user = await getCurrentUser();
  const allowed = user && (attachment.ticket.userId === user.id || hasAdminArea(user, "admin.tickets"));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const buf = await readUpload(attachment.filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: privateFileHeaders(attachment.fileName, attachment.mimeType),
  });
}
