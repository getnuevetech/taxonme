import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Programmatic login (also usable with curl for diagnostics):
//   curl -i -c cookies.txt -X POST -d "email=...&password=..." <url>/api/auth/login
// Sets the same session cookie as the login page.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
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
  email = email.toLowerCase().trim();

  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
  if (!checkRateLimit(rateLimitKey(["api-login", email, ip]), 8, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Too many sign-in attempts" }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Account not active" }, { status: 403 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, email: user.email, role: user.role });
}
