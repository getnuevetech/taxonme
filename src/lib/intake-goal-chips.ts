/**
 * Package AE — intake goal chips are evidence-first outcomes, not resolution mechanisms.
 * Clicking a chip appends into USER_REPORTED goal text — never name FTA / 9465 / installment.
 */
export const INTAKE_GOAL_CHIPS = [
  "Find out what I owe",
  "Understand an IRS letter",
  "Know which years need returns",
  "Confirm my account on a transcript",
  "Get a clear next step from the facts",
] as const;

/** Mechanisms that must not appear on intake goal chips (Package A / AE). */
export const INTAKE_GOAL_CHIP_MECHANISM_RE =
  /set up a payment plan|reduce penalties|installment agreement|form\s*9465|offer in compromise|\boic\b|first[- ]?time abatement|\bfta\b|\baep\b|currently not collectible|\bcnc\b/i;

// Signals drawn from what the user already typed in step 1 — a chip whose
// signal matches is a goal they're likely already reaching for, so it leads
// instead of the fixed, content-blind order every situation used to see.
const CHIP_SIGNALS: { chip: (typeof INTAKE_GOAL_CHIPS)[number]; pattern: RegExp }[] = [
  { chip: "Find out what I owe", pattern: /\b(owe|balance (due|owed)|debt|collections|garnish|levy|lien)\b/i },
  { chip: "Understand an IRS letter", pattern: /\b(notice|letter|cp\s?-?\d{2,4}|l?tr?\s?-?\d{3,4})\b/i },
  { chip: "Know which years need returns", pattern: /\b(haven'?t filed|not filed|unfiled|missing return|behind on|catch up|never filed)\b/i },
  { chip: "Confirm my account on a transcript", pattern: /\b(transcript|irs account|online account)\b/i },
];

/** Reorders the chips so any matching what the user already described lead. */
export function rankIntakeGoalChips(situationText: string): readonly (typeof INTAKE_GOAL_CHIPS)[number][] {
  const text = situationText || "";
  const matched = new Set(CHIP_SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.chip));
  if (matched.size === 0) return INTAKE_GOAL_CHIPS;
  return [...INTAKE_GOAL_CHIPS].sort((a, b) => Number(matched.has(b)) - Number(matched.has(a)));
}
