import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/uploads";

// Serves the signed-in user's own profile picture.
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.avatarPath) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await readUpload(user.avatarPath);
    const ext = user.avatarPath.split(".").pop()?.toLowerCase() ?? "png";
    const type = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
