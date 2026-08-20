import { NextResponse } from "next/server";

/**
 * Redirect within the app without copying the server's own origin.
 *
 * `new URL("/path", request.url)` inherits the internal host the process
 * bound to — often `http://localhost:3000`, or `https://localhost:3000` when a
 * proxy sets X-Forwarded-Proto. The browser then leaves the host the customer
 * is actually on. A relative Location stays on that host.
 */
export function sameOriginRedirect(path: string): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("same-origin redirects must be a root-relative path");
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "private, no-store" },
  });
}
