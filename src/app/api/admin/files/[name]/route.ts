import { NextResponse } from "next/server";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { readUpload } from "@/lib/uploads";

// Serves consultant credential documents (license proof, photo ID, insurance)
// to admins reviewing applications. Requires the Consultants admin area.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const user = await getCurrentUser();
  if (!user || !hasAdminArea(user, "admin.consultants")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const buf = await readUpload(name);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Disposition": "inline" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
