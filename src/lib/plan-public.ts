/**
 * Public-facing plan blurbs (Wave 3a). Pricing page still reads DB descriptions;
 * these strings are gated by the billing check and used where copy is code-owned.
 */
export const PUBLIC_PLAN_DESCRIPTIONS: Record<string, string> = {
  free:
    "Explore notices and tax Q&A before you file — Free does not include Prep Plan builds or IRS form wizards.",
  plus:
    "Handle a tax situation end to end with capped Prep Plan builds and form wizards/downloads each month — even if you have not filed yet.",
  pro:
    "Unlimited Prep Plan builds, form wizards, and downloads — plus CPA/EA professional referral when both sides consent.",
};
