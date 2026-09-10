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
