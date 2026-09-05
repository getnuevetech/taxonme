/**
 * Package E — evidence-proportional presentation depth.
 * Empty module = render nothing; thin intakes stay short.
 */

import type { EvidenceSnapshot } from "@/lib/ai/evidence-proportional";

export type PresentationDepthInput = EvidenceSnapshot & {
  hasNotice?: boolean;
  hasEstablishedPosition?: boolean;
  hasTimeline?: boolean;
};

/** Thin customer surface: no transcript/notice-backed account position yet. */
export function isThinCustomerPresentation(ev: PresentationDepthInput): boolean {
  if (ev.hasEstablishedPosition || ev.hasTimeline) return false;
  if (ev.hasTranscript && ev.hasAmount) return false;
  if (ev.hasNotice && ev.hasAmount) return false;
  // Transcript or notice alone still thin until amount/position established —
  // but allow slightly deeper modules once IRS records exist.
  if (ev.hasTranscript || ev.hasNotice) return false;
  return !ev.hasAmount;
}

/** "Why TaxOnMe says this" / analysis outline — only after evidence depth. */
export function shouldShowAnalysisOutline(ev: PresentationDepthInput): boolean {
  return !isThinCustomerPresentation(ev);
}

/** Finding-card "How we reached this" — omit on thin intake. */
export function shouldShowHowWeReached(ev: PresentationDepthInput): boolean {
  return !isThinCustomerPresentation(ev);
}

/** Drop premature "confirm resolution" stubs when nothing was resolved yet. */
export function filterPathStepsForDepth<T extends { title: string; description?: string; action_key?: string; actionKey?: string }>(
  steps: T[],
  ev: PresentationDepthInput,
): T[] {
  if (!isThinCustomerPresentation(ev)) return steps;
  return steps.filter((s) => {
    const blob = `${s.title} ${s.description ?? ""} ${s.action_key ?? s.actionKey ?? ""}`;
    if (/confirm the resolution/i.test(blob)) return false;
    if (/(9465|payment plan|penalty relief|offer in compromise|abatement)/i.test(blob)) return false;
    return true;
  });
}

export function shouldShowPathForwardSection(stepCount: number): boolean {
  return stepCount > 0;
}

/** Customer doc checklist: keep short on thin intake. */
export function documentChecklistLimit(ev: PresentationDepthInput): number {
  return isThinCustomerPresentation(ev) ? 2 : 6;
}
