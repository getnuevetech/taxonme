import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { createSession, secureCookiesEnabled } from "@/lib/auth";
import { claimGuestSession } from "@/lib/guest";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const appUrl = (await getSetting("app.url", "")) || url.origin;
  if (!code) return NextResponse.redirect(`${appUrl}/login`);

  // Verify CSRF state nonce to prevent login CSRF attacks.
  const returnedState = url.searchParams.get("state") ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state")?.value ?? "";
  if (!returnedState || returnedState !== expectedState) {
    const stateFailResponse = NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
    stateFailResponse.cookies.set("oauth_state", "", { httpOnly: true, secure: await secureCookiesEnabled(), maxAge: 0, path: "/" });
    return stateFailResponse;
  }

  const clientId = await getSetting("auth.google_client_id", "");
  const clientSecret = await getSetting("auth.google_client_secret", "");
  if (!clientId || !clientSecret) return NextResponse.redirect(`${appUrl}/login`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/login?error=google`);
  const tokens = await tokenRes.json();

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return NextResponse.redirect(`${appUrl}/login?error=google`);
  const info = await infoRes.json();
  // Email is compulsory regardless of registration method.
  if (!info.email) return NextResponse.redirect(`${appUrl}/login?error=no_email`);

  let user = await db.user.findFirst({
    where: { OR: [{ googleId: info.id }, { email: info.email.toLowerCase() }] },
  });
  if (!user) {
    user = await db.user.create({
      data: {
        email: info.email.toLowerCase(),
        googleId: info.id,
        firstName: info.given_name ?? "",
        lastName: info.family_name ?? "",
        emailVerifiedAt: new Date(),
      },
    });
    const agreement = await db.contentPage.findFirst({
      where: { kind: "agreement_user", isPublished: true },
      orderBy: { version: "desc" },
    });
    if (agreement) {
      await db.agreementAcceptance.create({
        data: { userId: user.id, pageId: agreement.id, version: agreement.version, context: "registration" },
      });
    }
    const { sendSystemMessage } = await import("@/lib/messaging");
    await sendSystemMessage("account_created", user, { link: "/app" });
  } else if (!user.googleId) {
    if (user.passwordHash) {
      const response = NextResponse.redirect(`${appUrl}/login?error=account_exists`);
      response.cookies.set("oauth_state", "", { httpOnly: true, secure: await secureCookiesEnabled(), maxAge: 0, path: "/" });
      return response;
    }
    user = await db.user.update({ where: { id: user.id }, data: { googleId: info.id } });
  }
  if (user.status !== "active") return NextResponse.redirect(`${appUrl}/login?error=inactive`);

  await claimGuestSession(user.id);
  await createSession(user.id);
  const response = NextResponse.redirect(`${appUrl}/app`);
  // Clear the state cookie after successful use.
  response.cookies.set("oauth_state", "", { httpOnly: true, secure: await secureCookiesEnabled(), maxAge: 0, path: "/" });
  return response;
}
