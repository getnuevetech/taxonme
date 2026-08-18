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
        material_difference: false,
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
  return a.normalized_category !== b.normalized_category && (a.material_difference || b.material_difference);
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

export function normalizeActionPurpose(value: string): string {
  const text = value.toLowerCase();
  if (/(notice|letter|correspondence|cp\d+|lt\d+)/i.test(text)) return "VERIFY_NOTICE";
  if (/(transcript|account record|irs account)/i.test(text)) return "VERIFY_TRANSCRIPT";
  if (/(balance|amount|liability|owe|refund)/i.test(text)) return "VERIFY_AMOUNT";
  if (/(deadline|date|respond by)/i.test(text)) return "VERIFY_DEADLINE";
  if (/(professional|consultant|cpa|ea|attorney)/i.test(text)) return "GET_PROFESSIONAL_REVIEW";
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "UNCLASSIFIED_ACTION";
}
