export type InformationCondition =
  | "MISSING_INFORMATION"
  | "UNVERIFIED_INFORMATION"
  | "SOURCE_CONFLICT"
  | "MODEL_DISAGREEMENT";

export type NormalizedConcept = {
  raw_value: string;
  normalized_category: string;
  normalized_meaning: string;
  material_difference: boolean;
};

const GOAL_PATTERNS: { category: string; meaning: string; patterns: RegExp[] }[] = [
  {
    category: "IRS_DEBT_RESOLUTION",
    meaning: "Resolve verified federal tax liabilities",
    patterns: [/\b(debt free|clear what i owe|resolve.*irs debt|owe.*irs|tax debt|balance)\b/i],
  },
  {
    category: "REFUND_STATUS",
    meaning: "Understand or resolve a refund, offset, hold, or refund discrepancy",
    patterns: [/\b(refund|offset|overpayment|deposit|where.*refund)\b/i],
  },
  {
    category: "NOTICE_RESPONSE",
    meaning: "Understand and respond to tax authority correspondence",
    patterns: [/\b(notice|letter|cp\d+|lt\d+|ltr\s?\d+|correspondence)\b/i],
  },
  {
    category: "FILING_COMPLIANCE",
    meaning: "Resolve missing, late, amended, or uncertain return filing obligations",
    patterns: [/\b(unfiled|not filed|late filing|amended return|missing return|filed wrong)\b/i],
  },
];

export function normalizeConcept(raw: string): NormalizedConcept {
  const value = raw.trim();
  for (const option of GOAL_PATTERNS) {
    if (option.patterns.some((pattern) => pattern.test(value))) {
      return {
        raw_value: raw,
        normalized_category: option.category,
        normalized_meaning: option.meaning,
        // Goal-category matches are material when compared across categories.
        material_difference: true,
      };
    }
  }
  return {
    raw_value: raw,
    normalized_category: "UNCLASSIFIED",
    normalized_meaning: value || "Unclassified or unstated concept",
    material_difference: false,
  };
}

export function conceptsConflict(a: NormalizedConcept, b: NormalizedConcept): boolean {
  if (a.normalized_category === b.normalized_category) return false;
  // Unclassified vs classified is incomplete information, not a conflict.
  if (a.normalized_category === "UNCLASSIFIED" || b.normalized_category === "UNCLASSIFIED") {
    return false;
  }
  // Different classified goal categories (e.g. debt resolution vs refund) conflict.
  return a.material_difference || b.material_difference;
}

export function classifyInformationCondition(input: {
  exists: boolean;
  verified: boolean;
  evidenceValues?: unknown[];
  modelValues?: unknown[];
}): InformationCondition {
  if (!input.exists) return "MISSING_INFORMATION";
  const evidenceValues = new Set((input.evidenceValues ?? []).filter((v) => v !== null && v !== undefined && v !== "").map((v) => String(v).trim().toLowerCase()));
  const modelValues = new Set((input.modelValues ?? []).filter((v) => v !== null && v !== undefined && v !== "").map((v) => String(v).trim().toLowerCase()));
  if (evidenceValues.size > 1) return "SOURCE_CONFLICT";
  if (modelValues.size > 1) return "MODEL_DISAGREEMENT";
  if (!input.verified) return "UNVERIFIED_INFORMATION";
  return "UNVERIFIED_INFORMATION";
}

export function isMaterialDifference(topic: string): boolean {
  return /(amount|balance|refund|deadline|date|year|period|entity|identity|filing|eligibility|liability|risk|action|professional|outcome)/i.test(topic);
}

// An action's purpose is its intent applied to a subject. Two actions are the
// same only when both match: "verify the balance" and "choose how to resolve
// the balance" share a subject but are different work, and merging them would
// hide something the customer still has to do.
function actionIntent(text: string): string {
  if (/(choose|select|decide|pick|elect)/.test(text)) return "SELECT";
  if (/(draft|write|compose|prepare a letter)/.test(text)) return "DRAFT";
  if (/(file|submit|mail|send)/.test(text)) return "SUBMIT";
  if (/(get|obtain|request|download|upload|add|provide|gather)/.test(text)) return "OBTAIN";
  return "VERIFY";
}

function actionSubject(text: string): string {
  if (/(professional|consultant|cpa|enrolled agent|attorney)/.test(text)) return "PROFESSIONAL";
  if (/(resolution|payment plan|installment|option|agreement|offer)/.test(text)) return "RESOLUTION";
  if (/(transcript|account record|irs account)/.test(text)) return "TRANSCRIPT";
  if (/(notice|letter|correspondence|cp\d+|lt\d+)/.test(text)) return "NOTICE";
  if (/(deadline|respond by|due date)/.test(text)) return "DEADLINE";
  if (/(balance|amount|liability|owe|refund)/.test(text)) return "AMOUNT";
  if (/(return|filing|file taxes)/.test(text)) return "RETURN";
  if (/(document|evidence|record)/.test(text)) return "DOCUMENTS";
  return "";
}

export function normalizeActionPurpose(value: string): string {
  const text = value.toLowerCase();
  const subject = actionSubject(text);
  if (!subject) {
    return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "UNCLASSIFIED_ACTION";
  }
  if (subject === "PROFESSIONAL") return "GET_PROFESSIONAL_REVIEW";
  const intent = actionIntent(text);
  if (subject === "RESOLUTION") return intent === "SELECT" ? "SELECT_RESOLUTION" : "ASSESS_RESOLUTION_OPTIONS";
  if (intent === "SELECT") return "SELECT_RESOLUTION";
  if (intent === "DRAFT") return "DRAFT_CORRESPONDENCE";
  if (intent === "SUBMIT") return subject === "RETURN" ? "FILE_RETURN" : "SUBMIT_RESPONSE";
  if (intent === "OBTAIN") return subject === "TRANSCRIPT" ? "OBTAIN_TRANSCRIPT" : `OBTAIN_${subject}`;
  return `VERIFY_${subject}`;
}
