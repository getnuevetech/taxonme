/**
 * Package G — period-sensitive IRS knowledge seed definitions + refresh helpers.
 * Seed applies these with create-or-update so re-seed fixes stale taxYear/tags/content.
 */

export type KnowledgeAuthoritySeed = {
  title: string;
  sourceType: string;
  reference: string;
  tags: string;
  content: string;
  taxYear?: number | null;
};

/** Sources whose taxYear / threshold wording must stay current on re-seed. */
export const PERIOD_SENSITIVE_KNOWLEDGE: KnowledgeAuthoritySeed[] = [
  {
    title: "Installment agreements (payment plans)",
    sourceType: "rule",
    reference: "Form 9465 / IRC 6159",
    tags: "payment plan, installment agreement, balance due, requires_known_balance",
    taxYear: null,
    content:
      "Individuals who owe $50,000 or less in combined tax, penalties, and interest can generally set up a long-term installment agreement online (streamlined, no financial statement). Short-term plans (up to 180 days) are available for balances under $100,000. Setup fees vary and are lower for direct-debit agreements; low-income taxpayers may qualify for fee waivers. While an agreement is in effect the failure-to-pay penalty rate is reduced. Defaulting (missing payments or new unpaid balances) can terminate the agreement. A pending installment agreement request generally suspends levy action.",
  },
  {
    title: "First-time penalty abatement",
    sourceType: "rule",
    reference: "FTA / IRM 20.1.1.3.3.2.1",
    tags: "penalty, abatement, relief, first time, fta, applies_through_2024",
    taxYear: 2024,
    content:
      "First-time abatement (FTA) provides administrative relief from failure-to-file, failure-to-pay, and failure-to-deposit penalties for eligible periods generally through tax year 2024 when the taxpayer: (1) has a clean compliance history for the prior 3 years (no significant penalties), (2) has filed all currently required returns or valid extensions, and (3) has paid or arranged to pay any tax due (an installment agreement in good standing qualifies). FTA can be requested by phone or in writing. Interest on the abated penalty is also removed, but interest on the tax itself is statutory and cannot be abated for reasonable cause. Reasonable-cause relief is a separate path for circumstances such as serious illness or disaster.",
  },
  {
    title: "Automatic Exemption from Penalty (AEP)",
    sourceType: "rule",
    reference: "AEP / IRS penalty relief transition",
    tags: "penalty, abatement, relief, aep, ty2025",
    taxYear: 2025,
    content:
      "Beginning with tax year 2025 (and certain 2026 quarterly returns), the IRS is transitioning from First Time Abate (FTA) to the Automatic Exemption from Penalty (AEP) for eligible original returns. AEP provides administrative relief from certain failure-to-file and failure-to-pay penalties when eligibility criteria for the period are met. Reasonable-cause relief remains a separate path. Always confirm the tax period and penalty codes on the Account Transcript before selecting FTA vs AEP language in a request.",
  },
];

export type KnowledgeSourceWrite = {
  sourceType: string;
  reference: string;
  tags: string;
  content: string;
  taxYear: number | null;
};

/** Fields written on create or corrective update. */
export function knowledgeSourceWriteData(seed: KnowledgeAuthoritySeed): KnowledgeSourceWrite {
  return {
    sourceType: seed.sourceType,
    reference: seed.reference,
    tags: seed.tags,
    content: seed.content,
    taxYear: seed.taxYear ?? null,
  };
}

/** True when an existing row is missing period tags / year / content that seed expects. */
export function knowledgeSourceNeedsRefresh(
  existing: KnowledgeSourceWrite,
  desired: KnowledgeAuthoritySeed,
): boolean {
  const want = knowledgeSourceWriteData(desired);
  return (
    existing.sourceType !== want.sourceType ||
    existing.reference !== want.reference ||
    existing.tags !== want.tags ||
    existing.content !== want.content ||
    (existing.taxYear ?? null) !== want.taxYear
  );
}

export function expectedFtaTaxYear(): number {
  return 2024;
}

export function expectedAepTaxYear(): number {
  return 2025;
}

export function ftaSeed(): KnowledgeAuthoritySeed {
  return PERIOD_SENSITIVE_KNOWLEDGE.find((s) => s.title === "First-time penalty abatement")!;
}

export function aepSeed(): KnowledgeAuthoritySeed {
  return PERIOD_SENSITIVE_KNOWLEDGE.find((s) => s.title === "Automatic Exemption from Penalty (AEP)")!;
}

export function installmentSeed(): KnowledgeAuthoritySeed {
  return PERIOD_SENSITIVE_KNOWLEDGE.find((s) => s.title === "Installment agreements (payment plans)")!;
}
