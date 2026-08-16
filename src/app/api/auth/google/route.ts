import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSetting } from "@/lib/settings";
import { secureCookiesEnabled } from "@/lib/auth";

// Google OAuth start. Client ID/secret and redirect URL are configured by the
// admin in Settings (auth.google_client_id, auth.google_client_secret, app.url).
export async function GET(request: Request) {
  const clientId = await getSetting("auth.google_client_id", "");
  const appUrl = (await getSetting("app.url", "")) || new URL(request.url).origin;
  if (!clientId) return NextResponse.redirect(new URL("/login", appUrl));

  // Generate a CSRF state nonce to prevent login CSRF attacks.
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  // Store state in a short-lived HttpOnly cookie for verification in the callback.
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookiesEnabled(),
    maxAge: 300, // 5 minutes
    path: "/",
  });
  return response;
}
