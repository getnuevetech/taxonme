/**
 * Package B — authority timing gates.
 * Do not surface installment dollar thresholds or FTA/AEP names before facts support them.
 * Package P — same gates apply to Pipeline A / notice keyword retrieval.
 */

import type { EvidenceSnapshot } from "@/lib/ai/evidence-proportional";

export type QueryAuthoritySnapshot = EvidenceSnapshot & {
  amountCents?: number | null;
  userAskedInstallmentEducation?: boolean;
  userAskedReliefEducation?: boolean;
  caseTaxYear: number | null;
};

/** Derive authority-gate inputs from free-text Q&A / notice / lab queries. */
export function snapshotFromQueryText(query: string): QueryAuthoritySnapshot {
  const q = String(query ?? "");
  const lower = q.toLowerCase();
  const amountMatch = q.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : NaN;
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const years = Array.from(q.matchAll(/\b(?:19|20)\d{2}\b/g))
    .map((m) => Number(m[0]))
    .filter((y) => y >= 1990 && y <= 2100);
  return {
    hasDocs: false,
    hasTranscript: /\btranscript\b/i.test(q),
    hasAmount,
    hasTaxYear: years.length > 0,
    amountCents: hasAmount ? Math.round(amount * 100) : null,
    userAskedInstallmentEducation: /\b(installment|payment plan|9465|streamlined)\b/i.test(lower),
    userAskedReliefEducation:
      /\b(first[\s-]?time\s+abat(?:e|ement)|fta|aep|penalty relief|abatement)\b/i.test(lower),
    caseTaxYear: years.length ? years[years.length - 1] : null,
  };
}

export function shouldRetrieveInstallmentThresholds(
  ev: EvidenceSnapshot & {
    amountCents?: number | null;
    userAskedInstallmentEducation?: boolean;
  },
): boolean {
  if (ev.userAskedInstallmentEducation) return true;
  if (ev.hasAmount) return true;
  if (typeof ev.amountCents === "number" && ev.amountCents > 0) return true;
  return false;
}

/** True only when a tax year is known — naming a specific relief program requires the period. */
export function shouldNameFtaOrAep(taxYear: number | null | undefined): boolean {
  return typeof taxYear === "number" && taxYear >= 1990 && taxYear <= 2100;
}

/**
 * IRS transitioning FTA → AEP for eligible original returns beginning tax year 2025
 * (and certain 2026 quarterly returns). Prior periods remain FTA-relevant.
 */
export function reliefProgramLabel(taxYear: number): "FTA" | "AEP" | "administrative_relief" {
  if (taxYear >= 2025) return "AEP";
  return "FTA";
}

export function neutralPenaltyReliefCopy(taxYear: number | null | undefined): string {
  if (!shouldNameFtaOrAep(taxYear)) {
    return "Some penalties may qualify for administrative or reasonable-cause relief depending on the tax period and compliance history. We'll evaluate the correct current path after identifying the periods and penalties involved.";
  }
  const label = reliefProgramLabel(taxYear!);
  if (label === "AEP") {
    return `For tax year ${taxYear}, eligible returns may qualify under the IRS Automatic Exemption from Penalty (AEP) program or reasonable-cause relief, depending on the facts. Confirm penalty types on the Account Transcript before requesting relief.`;
  }
  return `For tax year ${taxYear}, First Time Abate (FTA) or reasonable-cause relief may apply when compliance history and penalty types fit current IRS rules. Confirm assessed penalties on the Account Transcript before requesting relief.`;
}

const INSTALLMENT_THRESHOLD_RE = /\$\s?50,?000|\$\s?100,?000|streamlined monthly|180-day short-term/i;
const FTA_AEP_RE = /first[- ]?time abate|first[- ]?time abatement|\bFTA\b|\bAEP\b|automatic exemption from penalty/i;

export function authoritySourceBlockedByGates(
  source: { title: string; tags: string; content: string; taxYear: number | null },
  opts: {
    allowInstallmentThresholds: boolean;
    allowNamedRelief: boolean;
    caseTaxYear: number | null;
  },
): boolean {
  const hay = `${source.title} ${source.tags} ${source.content}`;
  if (!opts.allowInstallmentThresholds && INSTALLMENT_THRESHOLD_RE.test(hay)) return true;
  if (!opts.allowNamedRelief && FTA_AEP_RE.test(hay)) return true;
  // Year-stamped sources must match when case year is known.
  if (
    opts.caseTaxYear &&
    source.taxYear &&
    source.taxYear !== opts.caseTaxYear
  ) {
    // Allow evergreen mismatch only when source year is far — strict match for stamped years.
    if (Math.abs(source.taxYear - opts.caseTaxYear) >= 1) return true;
  }
  return false;
}

/** Gate options for free-text retrieval (Q&A / notice / lab). */
export function authorityGateOptsFromQuery(query: string): {
  snap: QueryAuthoritySnapshot;
  allowInstallmentThresholds: boolean;
  allowNamedRelief: boolean;
} {
  const snap = snapshotFromQueryText(query);
  return {
    snap,
    allowInstallmentThresholds: shouldRetrieveInstallmentThresholds(snap),
    allowNamedRelief: shouldNameFtaOrAep(snap.caseTaxYear) || Boolean(snap.userAskedReliefEducation),
  };
}
