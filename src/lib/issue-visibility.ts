/**
 * Package C — paywall-safe issue ordering and visibility.
 */

export const ISSUE_PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortIssuesBySeverity<T extends { priority: string }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => {
    const ra = ISSUE_PRIORITY_RANK[String(a.priority).toLowerCase()] ?? 50;
    const rb = ISSUE_PRIORITY_RANK[String(b.priority).toLowerCase()] ?? 50;
    return ra - rb;
  });
}

export function isPaywallProtectedFinding(issue: {
  priority?: string;
  state?: string | null;
  itemKind?: string | null;
  title?: string | null;
  issueType?: string | null;
}): boolean {
  const priority = String(issue.priority ?? "").toLowerCase();
  const state = String(issue.state ?? "").toLowerCase();
  const kind = String(issue.itemKind ?? "").toLowerCase();
  const title = String(issue.title ?? "");
  const type = String(issue.issueType ?? "").toLowerCase();
  if (priority === "urgent" || state === "urgent") return true;
  if (kind === "risk") return true;
  if (/(levy|lien|final notice|intent to levy|collection due process|\blt11\b|\blt16\b)/i.test(title)) {
    return true;
  }
  if (type === "notice_response" && /(lt|final|levy)/i.test(title)) return true;
  return false;
}

export function selectVisibleIssues<T extends {
  id?: string;
  priority: string;
  state?: string | null;
  itemKind?: string | null;
  title?: string | null;
  issueType?: string | null;
}>(
  issues: T[],
  opts: { fullAccess: boolean; maxFull?: number },
): { visible: T[]; hiddenCount: number } {
  const sorted = sortIssuesBySeverity(issues);
  if (opts.fullAccess) {
    const max = opts.maxFull ?? 5;
    const visible = sorted.slice(0, max);
    return { visible, hiddenCount: Math.max(0, sorted.length - visible.length) };
  }
  // Free tier: always surface safety findings first, then fill to at least 1.
  const protectedOnes = sorted.filter((i) => isPaywallProtectedFinding(i));
  const rest = sorted.filter((i) => !isPaywallProtectedFinding(i));
  const visible: T[] = [];
  for (const i of protectedOnes) {
    if (!visible.includes(i)) visible.push(i);
  }
  if (visible.length === 0 && rest[0]) visible.push(rest[0]);
  // Cap free visible set: all protected + at most one non-protected.
  else if (visible.length > 0) {
    /* protected already included */
  }
  const hiddenCount = Math.max(0, sorted.length - visible.length);
  return { visible, hiddenCount };
}
