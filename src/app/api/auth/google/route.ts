import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

// Google OAuth start. Client ID/secret and redirect URL are configured by the
// admin in Settings (auth.google_client_id, auth.google_client_secret, app.url).
export async function GET(request: Request) {
  const clientId = await getSetting("auth.google_client_id", "");
  const appUrl = (await getSetting("app.url", "")) || new URL(request.url).origin;
  if (!clientId) return NextResponse.redirect(new URL("/login", appUrl));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
