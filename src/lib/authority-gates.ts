/**
 * Package B — authority timing gates.
 * Do not surface installment dollar thresholds or FTA/AEP names before facts support them.
 */

import type { EvidenceSnapshot } from "@/lib/ai/evidence-proportional";

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
