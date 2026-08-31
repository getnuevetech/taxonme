/**
 * Agency-matter detection (IRS / state DOR / Tax Court / Collections).
 * Detection may set customer_state — it does NOT by itself invoke V5.1 / Case engine.
 */

const AGENCY_ID_RE =
  /\b(notice\s*(number|#|no\.?)|cp\s?-?\d{3,4}|lt\s?-?\d{2,4}|ltr?\s?-?\d+|cin\s*\d|letter\s*id|assessment\s*(id|number)|levy\s*(id|notice)|lien\s*(id|notice))\b/i;

const FILED_RETURN_RE =
  /\b(filed|pending|submitted|e-?filed|accepted)\b.{0,40}\b(1040|1120|941|schedule\s*[a-z]|return|amended\s*return)\b|\b(1040|1120|941)\b.{0,40}\b(filed|pending|submitted|e-?filed|under\s+review)\b/i;

const NOTICE_EVENT_RE =
  /\b(cp\s?-?\d{3,4}|lt\s?-?\d+|audit|examination|levy|lien|collection\s+due\s+process|cdp|offer\s+in\s+compromise|installment\s+agreement|balance\s+due\s+notice|intent\s+to\s+levy|final\s+notice)\b/i;

const COURT_COLLECTIONS_RE =
  /\b(tax\s+court|petition\s+to\s+tax\s+court|collections?(\s+division)?|revenue\s+officer|acs\s+call|wage\s+garnishment|bank\s+levy)\b/i;

export type GovernmentMatterSignal = {
  existing_government_case: boolean;
  signals: string[];
  systems: Array<"irs" | "state_dor" | "tax_court_collections">;
};

export function detectGovernmentMatter(text: string, documentHints: string[] = []): GovernmentMatterSignal {
  const combined = [text, ...documentHints].filter(Boolean).join("\n");
  const signals: string[] = [];
  const systems = new Set<"irs" | "state_dor" | "tax_court_collections">();

  if (AGENCY_ID_RE.test(combined)) {
    signals.push("notice_or_assessment_id");
    systems.add("irs");
  }
  if (FILED_RETURN_RE.test(combined)) {
    signals.push("filed_return");
    systems.add("irs");
  }
  if (NOTICE_EVENT_RE.test(combined)) {
    signals.push("notice_event");
    systems.add("irs");
  }
  if (COURT_COLLECTIONS_RE.test(combined)) {
    signals.push("court_or_collections");
    systems.add("tax_court_collections");
  }
  if (/\b(state\s+(tax|dor|franchise)|franchise\s+tax\s+board|department\s+of\s+revenue)\b/i.test(combined)) {
    signals.push("state_agency");
    systems.add("state_dor");
  }

  // Explicit “I have not filed” / “yet to file” suppresses weak form-name-only noise.
  const explicitlyUnfiled =
    /\b(yet to file|haven'?t filed|have not filed|no filings? yet|never filed|nothing filed|unfiled)\b/i.test(combined);
  if (
    explicitlyUnfiled &&
    !AGENCY_ID_RE.test(combined) &&
    !NOTICE_EVENT_RE.test(combined) &&
    !COURT_COLLECTIONS_RE.test(combined)
  ) {
    return { existing_government_case: false, signals: [], systems: [] };
  }

  return {
    existing_government_case: signals.length > 0,
    signals,
    systems: [...systems],
  };
}
