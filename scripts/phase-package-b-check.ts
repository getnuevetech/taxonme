/**
 * Package B — dynamic evidence / authority timing gate.
 * Run: npx tsx scripts/phase-package-b-check.ts
 */
import Module from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const { amountUnknownFromText, preferEvidenceAsk } = await import("../src/lib/clarify-evidence");
  const { rankPotentialEvidenceSources } = await import("../src/lib/evidence/potential-sources");
  const {
    shouldRetrieveInstallmentThresholds,
    shouldNameFtaOrAep,
    reliefProgramLabel,
    authoritySourceBlockedByGates,
    neutralPenaltyReliefCopy,
  } = await import("../src/lib/authority-gates");
  const { groupCustomerUnknowns } = await import("../src/lib/evidence/unknown-groups");
  const { DOC_KINDS } = await import("../src/lib/constants");
  const { analyzeBranches } = await import("../src/lib/conversation/branch-analysis");

  const thin =
    "I owe IRS some money but I am not sure how much and what I need to do.";

  assert.equal(amountUnknownFromText(thin), true);
  const ask = preferEvidenceAsk({
    narrative: thin,
    hasTranscript: false,
    hasNoticeDoc: false,
    balanceIssueOpen: true,
  });
  assert.ok(ask);
  assert.notEqual(ask!.key, "balance_amount");
  assert.match(ask!.text, /transcript|notice/i);

  const ranked = rankPotentialEvidenceSources({
    issueTypes: ["balance_due"],
    hasTranscript: false,
    hasNotice: false,
    hasReturn: false,
    hasIncomeDocs: false,
    taxYear: null,
    amountKnown: false,
    unfiledDominant: false,
    narrativeMentionsNotice: false,
  });
  assert.ok(ranked.some((d) => d.kind === "transcript"));
  assert.equal(ranked.some((d) => d.kind === "1040"), false);
  assert.equal(ranked.some((d) => d.kind === "w2"), false);
  assert.equal(DOC_KINDS[0].key, "notice");

  assert.equal(
    shouldRetrieveInstallmentThresholds({
      hasDocs: false,
      hasTranscript: false,
      hasAmount: false,
      hasTaxYear: false,
    }),
    false,
  );
  assert.equal(shouldNameFtaOrAep(null), false);
  assert.equal(reliefProgramLabel(2024), "FTA");
  assert.equal(reliefProgramLabel(2025), "AEP");
  assert.doesNotMatch(neutralPenaltyReliefCopy(null), /first-time abatement|\bFTA\b|\bAEP\b/i);

  assert.equal(
    authoritySourceBlockedByGates(
      {
        title: "Installment agreements (payment plans)",
        tags: "requires_known_balance",
        content: "Individuals who owe $50,000 or less",
        taxYear: null,
      },
      { allowInstallmentThresholds: false, allowNamedRelief: false, caseTaxYear: null },
    ),
    true,
  );
  assert.equal(
    authoritySourceBlockedByGates(
      {
        title: "First-time penalty abatement",
        tags: "fta",
        content: "First-time abatement (FTA)",
        taxYear: 2024,
      },
      { allowInstallmentThresholds: true, allowNamedRelief: false, caseTaxYear: null },
    ),
    true,
  );

  const groups = groupCustomerUnknowns([
    { label: "The current balance (it grows with penalties and interest)" },
    { label: "Tax principal versus penalties versus interest" },
    { label: "Which notice/letter states it" },
    { label: "Payments or credits already applied" },
    { label: "Whether under active collection" },
    { label: "Specific penalty codes" },
  ]);
  assert.ok(groups.length <= 2);
  assert.ok(groups.some((g) => g.id === "account_position"));
  assert.ok(groups.some((g) => g.id === "irs_communication"));

  const branches = analyzeBranches({
    contract: {
      explicit_question: thin,
      interpreted_question: thin,
      decision_target: "identify_available_pathways",
      entities: [],
      constraints: [],
      success_criteria: [],
      ambiguity_flags: [],
    } as never,
    message: thin,
  });
  const blob = JSON.stringify(branches);
  assert.doesNotMatch(blob, /First-time abatement/i);

  const root = process.cwd();
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-B-DYNAMIC-EVIDENCE.md"), "utf8"),
    /Package B/i,
  );
  assert.ok(readFileSync(join(root, "src/lib/constants.ts"), "utf8").indexOf('key: "notice"') <
    readFileSync(join(root, "src/lib/constants.ts"), "utf8").indexOf('key: "w2"'));

  console.log("phase-package-b-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
