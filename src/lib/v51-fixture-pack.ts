/**
 * V5.1 Phase G — multi-fixture pack (tax). Positive + negative isolation.
 */

import { matterTypeLockFromBrief, type MatterTypeLock } from "@/lib/matter-type-lock";

export type FixtureIsolationRule = {
  must_allow?: RegExp[];
  must_forbid?: RegExp[];
  primary_module?: string | null;
  do_not_recommend_new_pathway?: boolean;
  lock_open_relief_options?: boolean;
};

export type TaxMatterFixtureInput = {
  situation: string;
  goal: string;
  primaryModule?: string | null;
  relatedModule?: string | null;
  doNotRecommendNewPathway?: boolean;
  lockOpenReliefOptions?: boolean;
  matterType?: string;
  documents?: Array<{ fileName: string; documentType?: string; text?: string }>;
};

export type V51PackFixture = {
  id: string;
  label: string;
  kind: "positive" | "negative";
  input: TaxMatterFixtureInput;
  isolation: FixtureIsolationRule;
};

export const CP2000_FIXTURE: TaxMatterFixtureInput = {
  situation:
    "I received IRS CP2000 for tax year 2023 notice number 12345 proposing additional wages. I have not responded yet.",
  goal: "Understand the notice and what to do next",
  primaryModule: "cp2000_underreporter",
  doNotRecommendNewPathway: true,
  matterType: "CP2000 underreporter",
  documents: [{ fileName: "cp2000-2023.pdf", documentType: "IRS_NOTICE", text: "CP2000 Notice Date" }],
};

export const LEVY_FIXTURE: TaxMatterFixtureInput = {
  situation:
    "I got an LT11 final notice of intent to levy. I owe about $8,000 for 2022 and cannot pay in full.",
  goal: "Stop the levy and set up a plan",
  primaryModule: "collection_levy",
  relatedModule: "installment_agreement",
  doNotRecommendNewPathway: true,
  matterType: "collection levy",
  documents: [{ fileName: "lt11-levy.pdf", documentType: "IRS_NOTICE", text: "Final notice LT11 intent to levy" }],
};

export const TRANSCRIPT_BALANCE_FIXTURE: TaxMatterFixtureInput = {
  situation: "The IRS says I owe money for 2023. I uploaded my account transcript showing ACCOUNT BALANCE: 2,879.00.",
  goal: "Confirm what I owe",
  primaryModule: "balance_due",
  doNotRecommendNewPathway: false,
  lockOpenReliefOptions: true,
  matterType: "balance due",
  documents: [
    {
      fileName: "account-transcript.pdf",
      documentType: "IRS_ACCOUNT_TRANSCRIPT",
      text: "ACCOUNT TRANSCRIPT TAX PERIOD ENDING: Dec. 31, 2023 ACCOUNT BALANCE: 2,879.00",
    },
  ],
};

export const W2_1040_MISMATCH_FIXTURE: TaxMatterFixtureInput = {
  situation: "My W-2 wages do not match what I reported on my 1040 for 2023.",
  goal: "Fix the mismatch before the IRS assesses",
  primaryModule: "underreporter_mismatch",
  doNotRecommendNewPathway: true,
  matterType: "W-2 / 1040 mismatch",
  documents: [
    { fileName: "w2-2023.pdf", documentType: "W2", text: "Form W-2 Wage and Tax Statement 2023" },
    { fileName: "1040-2023.pdf", documentType: "TAX_RETURN", text: "Form 1040 U.S. Individual Income Tax Return 2023" },
  ],
};

export const INSTALLMENT_OPTIONS_FIXTURE: TaxMatterFixtureInput = {
  situation: "I owe the IRS for 2022 and 2023 and I am not sure if I can pay monthly. What are my options?",
  goal: "Explore installment vs CNC vs OIC",
  primaryModule: "relief_options",
  doNotRecommendNewPathway: false,
  lockOpenReliefOptions: true,
  matterType: "open relief options",
};

export const STATE_NOTICE_FIXTURE: TaxMatterFixtureInput = {
  situation: "I received a Department of Revenue balance due notice for state income tax year 2022.",
  goal: "Respond to the state notice",
  primaryModule: "state_dor_balance",
  doNotRecommendNewPathway: true,
  matterType: "state DOR",
  documents: [
    { fileName: "state-dor-notice.pdf", documentType: "STATE_TAX_DOCUMENT", text: "Department of Revenue tax notice" },
  ],
};

export const V51_FIXTURE_PACK: V51PackFixture[] = [
  {
    id: "cp2000_response",
    label: "CP2000 underreporter response",
    kind: "positive",
    input: CP2000_FIXTURE,
    isolation: {
      primary_module: "cp2000_underreporter",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bcp\s?-?2000\b/i],
      must_forbid: [/start with an offer in compromise before responding to the CP2000/i],
    },
  },
  {
    id: "cp2000_neg_oic_first",
    label: "CP2000 (neg) — forbid OIC-before-response",
    kind: "negative",
    input: CP2000_FIXTURE,
    isolation: {
      primary_module: "cp2000_underreporter",
      do_not_recommend_new_pathway: true,
      must_forbid: [/start with an offer in compromise before responding to the CP2000/i, /file a new Form 1040 first/i],
    },
  },
  {
    id: "collection_levy",
    label: "LT11 / levy collections",
    kind: "positive",
    input: LEVY_FIXTURE,
    isolation: {
      primary_module: "collection_levy",
      do_not_recommend_new_pathway: true,
      must_allow: [/\blevy\b/i, /\blt\s?-?11\b/i],
      must_forbid: [/file a new Form 1040 first/i, /Schedule C audit workbook/i],
    },
  },
  {
    id: "levy_neg_exam_bleed",
    label: "Levy (neg) — forbid exam workbook bleed",
    kind: "negative",
    input: LEVY_FIXTURE,
    isolation: {
      primary_module: "collection_levy",
      do_not_recommend_new_pathway: true,
      must_forbid: [/Schedule C audit workbook/i, /audit exam education/i],
    },
  },
  {
    id: "transcript_balance",
    label: "Transcript confirms balance",
    kind: "positive",
    input: TRANSCRIPT_BALANCE_FIXTURE,
    isolation: {
      primary_module: "balance_due",
      lock_open_relief_options: true,
      must_allow: [/account transcript|2,?879/i],
    },
  },
  {
    id: "w2_1040_mismatch",
    label: "W-2 vs 1040 mismatch",
    kind: "positive",
    input: W2_1040_MISMATCH_FIXTURE,
    isolation: {
      primary_module: "underreporter_mismatch",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bw-?2\b/i, /\b1040\b/i],
      must_forbid: [/file a new Form 1040 first/i],
    },
  },
  {
    id: "relief_options_open",
    label: "Open installment / CNC / OIC options",
    kind: "positive",
    input: INSTALLMENT_OPTIONS_FIXTURE,
    isolation: {
      primary_module: "relief_options",
      lock_open_relief_options: true,
      do_not_recommend_new_pathway: false,
      must_allow: [/installment|options/i],
    },
  },
  {
    id: "state_dor_notice",
    label: "State DOR balance notice",
    kind: "positive",
    input: STATE_NOTICE_FIXTURE,
    isolation: {
      primary_module: "state_dor_balance",
      do_not_recommend_new_pathway: true,
      must_allow: [/department of revenue|state/i],
      must_forbid: [/file a new Form 1040 first/i],
    },
  },
];

export function lockFromFixture(input: TaxMatterFixtureInput): MatterTypeLock | null {
  return matterTypeLockFromBrief({
    primaryModule: input.primaryModule,
    relatedModule: input.relatedModule,
    doNotRecommendNewPathway: input.doNotRecommendNewPathway,
    lockOpenReliefOptions: input.lockOpenReliefOptions,
    matterType: input.matterType,
  });
}

export function sampleCustomerText(fixture: V51PackFixture, contaminated = false): string {
  const base = `${fixture.input.situation}\nGoal: ${fixture.input.goal}`;
  if (!contaminated) return base;
  if (fixture.input.primaryModule === "collection_levy") {
    return `${base}\nNext: file a new Form 1040 first and open the Schedule C audit workbook.`;
  }
  if (fixture.input.primaryModule === "cp2000_underreporter") {
    return `${base}\nNext: start with an offer in compromise before responding to the CP2000.`;
  }
  return `${base}\nNext: file a new Form 1040 first.`;
}
