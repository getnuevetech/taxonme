/**
 * Package H — when Pipeline A / Prep Plan may name resolution pathways.
 * Thin "I owe…" without amount/year/notice must not expand into installment/CNC/OIC.
 */

export function narrativeHasKnownBalance(text: string): boolean {
  return /\$\s?[\d,]+\.?\d*/.test(text) && /\b(owe|owed|owing|balance|debt|amount due)\b/i.test(text);
}

export function narrativeHasTaxYear(text: string): boolean {
  return /\btax\s*year\b|\b(20\d{2})\b/i.test(text);
}

export function narrativeMentionsIrsRecord(text: string): boolean {
  return /\b(transcript|cp\s?-?\d+|lt\s?-?\d+|ltr\s?-?\d+|notice|letter\s+\d+)\b/i.test(text);
}

export function narrativeExplicitlyAsksPathways(text: string): boolean {
  return /\b(options?|pathways?|paths?|what can i (do|file)|payment plan|installment|offer in compromise|currently not collectible|\bcnc\b)\b/i.test(
    text,
  );
}

/**
 * Resolution menus (installment / CNC / OIC / penalty) require enough facts that
 * the branches are decision-changing — not a keyword playbook on thin debt talk.
 */
export function canSurfaceResolutionPathways(text: string): boolean {
  if (narrativeHasKnownBalance(text)) return true;
  // Notice/transcript + tax year (or explicit options ask with an IRS record).
  if (narrativeMentionsIrsRecord(text) && (narrativeHasTaxYear(text) || narrativeExplicitlyAsksPathways(text))) {
    return true;
  }
  // Explicit hardship / payment-plan ask with at least a year or record cue.
  if (
    /\b(can'?t pay|cannot pay|payment plan|installment|9465|hardship|offer in compromise)\b/i.test(text) &&
    (narrativeHasTaxYear(text) || narrativeMentionsIrsRecord(text) || narrativeHasKnownBalance(text))
  ) {
    return true;
  }
  return false;
}
