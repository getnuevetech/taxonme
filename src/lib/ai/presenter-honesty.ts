/**
 * Package O — Presenter honesty: strip speculative thin-intake modules at source.
 * Complements Package L (transcript deepen) which only upgrades when a transcript establishes balance.
 */
import {
  shouldEmitExplanations,
  thinBalanceDueFinding,
  type EvidenceSnapshot,
} from "./evidence-proportional";

const SPECULATIVE_PLAYBOOK =
  /first[\s-]?time\s+abatement|\bFTA\b|installment\s+agreement|offer\s+in\s+compromise|\bOIC\b|currently\s+not\s+collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|penalty\s+relief/i;

export function isThinPresenterEvidence(ev: EvidenceSnapshot): boolean {
  if (ev.offsetConfirmed) return false;
  if (ev.hasTranscript && ev.hasAmount) return false;
  if (ev.hasAmount && ev.hasTaxYear && ev.hasDocs) return false;
  return !ev.hasAmount;
}

function issueHasAmount(issue: Record<string, unknown>): boolean {
  for (const key of ["expected_amount", "difference_amount", "received_amount"] as const) {
    const v = issue[key];
    if (typeof v === "number" && Number.isFinite(v)) return true;
  }
  return false;
}

function looksLikeSpeculativeBalanceDue(issue: Record<string, unknown>, ev: EvidenceSnapshot): boolean {
  if (String(issue.issue_type ?? "") !== "balance_due") return false;
  if (issueHasAmount(issue) || ev.hasAmount) return false;
  const status = String(issue.evidence_status ?? "").toLowerCase();
  if (status === "confirmed" || status === "not_supported") return false;
  return true;
}

/**
 * Fail-closed sanitize of AI presenter issues when evidence cannot support
 * explanations, forensic outlines, or resolution playbooks.
 */
export function sanitizeThinPresenterIssues(
  issues: Record<string, unknown>[],
  ev: EvidenceSnapshot,
): { issues: Record<string, unknown>[]; sanitized: boolean } {
  const allowExplanations = shouldEmitExplanations(ev);
  const thin = isThinPresenterEvidence(ev);
  let sanitized = false;

  const out = issues.map((issue) => {
    let next: Record<string, unknown> = { ...issue };

    if (!allowExplanations) {
      const explanations = Array.isArray(next.explanations) ? (next.explanations as unknown[]) : [];
      if (explanations.length > 0) {
        next.explanations = [];
        sanitized = true;
      }
    }

    if (thin && !issueHasAmount(next)) {
      const outline = Array.isArray(next.analysis_outline) ? (next.analysis_outline as unknown[]) : [];
      if (outline.length > 0) {
        next.analysis_outline = [];
        sanitized = true;
      }
    }

    if (looksLikeSpeculativeBalanceDue(next, ev)) {
      const blob = `${next.what_we_know ?? ""} ${next.our_conclusion ?? ""} ${next.title ?? ""}`;
      const playbook = SPECULATIVE_PLAYBOOK.test(blob);
      const fatOutline =
        Array.isArray(next.analysis_outline) && (next.analysis_outline as unknown[]).length > 0;
      const wrongKind = String(next.item_kind ?? "") !== "missing_info";
      const wrongStatus = String(next.evidence_status ?? "").toLowerCase() !== "needs_verification";

      if (playbook || fatOutline || wrongKind || wrongStatus || !allowExplanations) {
        const year =
          typeof next.tax_year === "number"
            ? next.tax_year
            : Number.isFinite(Number(next.tax_year)) && String(next.tax_year).trim() !== ""
              ? Number(next.tax_year)
              : null;
        const sparse = thinBalanceDueFinding({
          year,
          hasDocs: ev.hasDocs,
          docCount: ev.hasDocs ? 1 : 0,
          guidance: {
            what: "Identify what the IRS shows",
            action: "GET_TRANSCRIPT",
            state: "info_needed",
          },
          evidenceLine: ev.hasTranscript
            ? "IRS records on file are incomplete for amount."
            : "No IRS account records establishing amount yet.",
        });
        next = {
          ...sparse,
          // Preserve model title only when it is not a playbook headline.
          title: playbook ? sparse.title : String(next.title || sparse.title),
        };
        sanitized = true;
      }
    }

    return next;
  });

  return { issues: out, sanitized };
}
