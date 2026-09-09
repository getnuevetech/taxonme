/**
 * Package Q — Notice-explainer honesty.
 * Fail-closed sanitize for thin / unknown notices; no invented resolution playbooks.
 */

export const NOTICE_RESOLUTION_PLAYBOOK =
  /first[\s-]?time\s+abatement|\bFTA\b|installment\s+agreement|offer\s+in\s+compromise|\bOIC\b|currently\s+not\s+collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|penalty\s+relief|form\s*9465|payment\s+plan/i;

export type NoticeStep = { title: string; description: string };

export function extractNoticeCode(text: string): string {
  const match = String(text ?? "")
    .toUpperCase()
    .match(/\b(CP|LT|LTR)\s?-?\d{2,5}\b/);
  return match?.[0]?.replace(/\s|-/g, "") ?? "";
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function pickAmount(result: Record<string, unknown>): number | null {
  const direct = numOrNull(result.amount);
  if (direct != null) return direct;
  const amounts = Array.isArray(result.amounts) ? (result.amounts as Record<string, unknown>[]) : [];
  for (const row of amounts) {
    const v = numOrNull(row.amount) ?? numOrNull(row.value);
    if (v != null) return v;
  }
  return null;
}

function pickDeadline(result: Record<string, unknown>): string | null {
  const d = result.deadline;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(result.printed_deadlines) && typeof result.printed_deadlines[0] === "string") {
    return result.printed_deadlines[0];
  }
  return null;
}

function pickNoticeType(result: Record<string, unknown>, noticeText: string): string {
  const identity =
    typeof result.notice_identity === "object" && result.notice_identity !== null
      ? (result.notice_identity as Record<string, unknown>)
      : {};
  const fromResult = String(result.notice_type ?? identity.notice_type ?? "")
    .toUpperCase()
    .replace(/\s|-/g, "");
  return fromResult || extractNoticeCode(noticeText);
}

/** Thin = unknown code, needs verification, or no printed amount/deadline to anchor response choices. */
export function isThinNoticeExplanation(
  result: Record<string, unknown>,
  noticeText: string,
): boolean {
  const code = pickNoticeType(result, noticeText);
  const certainty = String(result.certainty ?? "").toUpperCase();
  if (!code) return true;
  if (certainty === "NEEDS_VERIFICATION") return true;
  const amount = pickAmount(result);
  const deadline = pickDeadline(result);
  if (amount == null && !deadline) return true;
  return false;
}

export function sparseNoticeNextSteps(opts: {
  hasCode: boolean;
  hasDeadline: boolean;
}): NoticeStep[] {
  const steps: NoticeStep[] = [
    {
      title: "Keep the notice safe",
      description: "It's stored in your document vault for reference.",
    },
  ];
  if (!opts.hasCode) {
    steps.push({
      title: "Identify the notice code",
      description:
        "Look near the top for a CP or LT code (for example CP14 or LT11). That code tells us which letter this is.",
    });
  }
  if (opts.hasDeadline) {
    steps.push({
      title: "Calendar the printed deadline",
      description:
        "Use the respond-by date printed on the notice — do not invent a deadline. Add it to your deadlines list.",
    });
  } else {
    steps.push({
      title: "Find the respond-by date",
      description:
        "IRS notices usually show a respond-by date near the top right. Confirm it on the letter before acting.",
    });
  }
  steps.push({
    title: "Confirm what the IRS shows",
    description:
      "An Account Transcript establishes the period, balance, and recent activity before choosing a response path.",
  });
  return steps;
}

function asSteps(value: unknown): NoticeStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (typeof row === "string") return { title: row, description: "" };
      if (typeof row === "object" && row !== null) {
        const r = row as Record<string, unknown>;
        return {
          title: String(r.title ?? r.category ?? r.label ?? "").trim(),
          description: String(r.description ?? r.detail ?? "").trim(),
        };
      }
      return { title: "", description: "" };
    })
    .filter((s) => s.title.length > 0);
}

function stripPlaybookSentences(text: string): string {
  if (!text.trim()) return text;
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((sentence) => !NOTICE_RESOLUTION_PLAYBOOK.test(sentence));
  if (kept.length > 0) return kept.join(" ").trim();
  // Entire blob was playbook — replace with neutral identify copy.
  return "We identified what we could from this letter. Confirm the notice code, printed deadline, and Account Transcript before choosing a response path.";
}

/**
 * Fail-closed sanitize of NOTICE stage / fallback JSON.
 */
export function sanitizeNoticeExplanation(
  result: Record<string, unknown>,
  noticeText: string,
): { result: Record<string, unknown>; sanitized: boolean; thin: boolean } {
  let sanitized = false;
  const next: Record<string, unknown> = { ...result };
  const code = pickNoticeType(next, noticeText);
  const thin = isThinNoticeExplanation(next, noticeText);
  const amount = pickAmount(next);
  const deadline = pickDeadline(next);
  const allowFatSteps = Boolean(code) && !thin;

  for (const key of ["plain_english_explanation", "what_it_means", "why_received"] as const) {
    if (typeof next[key] === "string" && NOTICE_RESOLUTION_PLAYBOOK.test(String(next[key]))) {
      const cleaned = stripPlaybookSentences(String(next[key]));
      if (cleaned !== next[key]) {
        next[key] = cleaned;
        sanitized = true;
      }
    }
  }

  let steps = asSteps(next.next_steps);
  const categories = asSteps(next.available_response_categories);
  const wants = asSteps(next.what_irs_wants);

  const filterPlaybook = (list: NoticeStep[]) =>
    list.filter((s) => !NOTICE_RESOLUTION_PLAYBOOK.test(`${s.title} ${s.description}`));

  const beforeSteps = JSON.stringify(steps);
  steps = filterPlaybook(steps);
  if (JSON.stringify(steps) !== beforeSteps) sanitized = true;

  if (!allowFatSteps) {
    const sparse = sparseNoticeNextSteps({
      hasCode: Boolean(code),
      hasDeadline: Boolean(deadline),
    });
    if (JSON.stringify(steps) !== JSON.stringify(sparse)) {
      steps = sparse;
      sanitized = true;
    }
    if (categories.length > 0) {
      next.available_response_categories = [];
      sanitized = true;
    }
    // Keep only non-playbook "what IRS wants" when thin; otherwise clear fat lists.
    const wantsClean = filterPlaybook(wants);
    if (wantsClean.length !== wants.length || wantsClean.length > 3) {
      next.what_irs_wants = wantsClean.slice(0, 2);
      sanitized = true;
    }
  }

  next.next_steps = steps;
  if (!next.notice_type && code) next.notice_type = code;
  if (thin && !next.certainty) next.certainty = "NEEDS_VERIFICATION";

  // Drop documents_needed that push Form 433 / full financials on thin notices.
  if (Array.isArray(next.documents_needed) && thin) {
    const docs = (next.documents_needed as unknown[])
      .map(String)
      .filter((d) => !/433|financial\s*statement|bank\s*statement|pay\s*stub/i.test(d));
    if (docs.length !== (next.documents_needed as unknown[]).length) {
      next.documents_needed = docs;
      sanitized = true;
    }
  }

  void amount;
  return { result: next, sanitized, thin };
}

/** Customer UI: show response-step modules only when the notice is identified and not thin. */
export function shouldShowNoticeNextSteps(opts: {
  noticeType: string;
  status: string;
  stepCount: number;
}): boolean {
  if (opts.stepCount <= 0) return false;
  if (!opts.noticeType.trim()) return false;
  if (opts.status === "verification_required" || opts.status === "analyzing") return false;
  return true;
}

export function shouldShowNoticeLetterCta(opts: {
  noticeType: string;
  status: string;
}): boolean {
  if (!opts.noticeType.trim()) return false;
  return opts.status === "explained";
}
