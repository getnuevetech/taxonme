import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

// Programmatic login (also usable with curl for diagnostics):
//   curl -i -c cookies.txt -X POST -d "email=...&password=..." <url>/api/auth/login
// Sets the same session cookie as the login page.
export async function POST(request: Request) {
  let email = "";
  let password = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    email = String(body.email ?? "");
    password = String(body.password ?? "");
  } else {
    const form = await request.formData().catch(() => null);
    email = String(form?.get("email") ?? "");
    password = String(form?.get("password") ?? "");
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Account not active" }, { status: 403 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, email: user.email, role: user.role });
}
