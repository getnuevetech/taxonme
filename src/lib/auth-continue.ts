/** Pure helpers for post-auth resume paths (safe for scripts / client). */

export type ClaimedGuestWork = {
  sessionId: string;
  threadId: string | null;
  caseId: string | null;
  situationId: string | null;
};

/** Only allow same-origin relative continue paths under /app or /start. */
export function sanitizeAuthNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = String(raw).trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname + new URL(path).search;
    }
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  if (!(path.startsWith("/app") || path.startsWith("/start"))) return null;
  if (path.length > 500) return null;
  return path;
}

/**
 * Where to send the user after login/register so guest work is not abandoned.
 * Priority: explicit next → claimed Situation → claimed Q&A thread → claimed case → fallback.
 */
export function continuePathAfterAuth(opts: {
  next?: string | null;
  claimed?: ClaimedGuestWork | null;
  fallback?: string;
}): string {
  const next = sanitizeAuthNext(opts.next);
  if (next) return next;
  if (opts.claimed?.situationId) return `/app/situations/${opts.claimed.situationId}`;
  if (opts.claimed?.threadId) return `/app/qa/${opts.claimed.threadId}`;
  if (opts.claimed?.caseId) return `/app/cases/${opts.claimed.caseId}`;
  return opts.fallback ?? "/app";
}
