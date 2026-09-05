/**
 * Package A — evidence-proportional honesty gate.
 * Run: npx tsx scripts/phase-package-a-honesty-check.ts
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
  const { conceptsConflict, normalizeConcept } = await import("../src/lib/case-semantics");
  const { preserveUserReportedGoal } = await import("../src/lib/ai/goal-provenance");
  const {
    shouldEmitExplanations,
    shouldEmitPenaltyReliefIssue,
    shouldEmitPrematureResolutionPath,
    thinBalanceDueFinding,
  } = await import("../src/lib/ai/evidence-proportional");
  const { mergeStructured, semanticEquivalence } = await import("../src/lib/ai/consensus");
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");

  const root = process.cwd();

  {
    const user =
      "I owe IRS some money but I am not sure how much and what I need to do.";
    const locked = preserveUserReportedGoal(user, {
      primary_goal: "Taxpayer states a goal of resolving past tax issues and reducing penalties.",
      secondary_goals: ["first-time abatement"],
      normalized_goal_categories: ["IRS_DEBT_RESOLUTION"],
    });
    assert.equal(locked.user_reported_goal, user);
    assert.equal(locked.user_goal, user);
    assert.doesNotMatch(locked.user_reported_goal, /penalt/i);
    assert.equal(locked.user_reported_goal.includes("reducing penalties"), false);
  }

  {
    const a = normalizeConcept("I want to be debt free.");
    const b = normalizeConcept("I want to resolve the IRS debt.");
    assert.equal(conceptsConflict(a, b), false);
    const c = normalizeConcept("Where is my refund?");
    assert.equal(conceptsConflict(a, c), true, "debt vs refund categories conflict");
  }

  {
    assert.equal(
      semanticEquivalence(
        "taxpayer owes an unspecified amount and doesn't know what to do",
        "taxpayer owes an unspecified amount, doesn't know what to do, and no documents were provided",
        "situation_summary",
      ),
      true,
    );
    const { merged, conflicts } = mergeStructured([
      {
        source: "model-a",
        data: {
          situation_summary: "Taxpayer owes an unspecified IRS balance and is unsure what to do next.",
        },
      },
      {
        source: "model-b",
        data: {
          situation_summary:
            "Taxpayer reports owing the IRS an unspecified amount, does not know next steps, and provided no documents.",
        },
      },
    ]);
    assert.equal(conflicts.length, 0, "synonymous prose must not conflict");
    assert.ok(typeof merged.situation_summary === "string");
  }

  {
    assert.equal(
      shouldEmitExplanations({
        hasDocs: false,
        hasTranscript: false,
        hasAmount: false,
        hasTaxYear: false,
      }),
      false,
    );
    assert.equal(
      shouldEmitPenaltyReliefIssue(
        { hasDocs: false, hasTranscript: false, hasAmount: false, hasTaxYear: false },
        true,
      ),
      false,
    );
    assert.equal(
      shouldEmitPrematureResolutionPath({
        hasDocs: false,
        hasTranscript: false,
        hasAmount: false,
        hasTaxYear: false,
      }),
      false,
    );
  }

  {
    const finding = thinBalanceDueFinding({
      year: null,
      hasDocs: false,
      docCount: 0,
      guidance: { what: "x", action: "UPLOAD_DOCUMENTS", state: "info_needed" },
      evidenceLine: "No documents are on file yet.",
    });
    assert.doesNotMatch(String(finding.title), /one figure unlocks/i);
    assert.doesNotMatch(String(finding.what_we_know), /\$50,000|first-time abatement/i);
    assert.deepEqual(finding.explanations, []);
    assert.ok(Array.isArray(finding.still_unclear) && (finding.still_unclear as string[]).length <= 2);
  }

  {
    const result = await fallbackAnalyze(
      "I owe IRS some money but I am not sure how much and what I need to do.",
      "I need to know what I owe and what to do.",
      "",
      [],
    );
    const blob = JSON.stringify(result);
    assert.ok(result.issues.some((i) => i.issue_type === "balance_due"));
    assert.equal(
      result.issues.every((i) => !Array.isArray(i.explanations) || (i.explanations as unknown[]).length === 0),
      true,
      "thin intake must not emit speculative explanations",
    );
    assert.doesNotMatch(blob, /one figure unlocks/i);
    assert.doesNotMatch(blob, /\$50,000/);
    assert.doesNotMatch(blob, /first-time abatement/i);
    assert.doesNotMatch(blob, /Request penalty relief in writing/i);
    assert.equal(
      result.pathSteps.some((s) => /penalty relief/i.test(s.title)),
      false,
    );
    assert.equal(
      result.pathSteps.some((s) => /9465|payment plan/i.test(s.title)),
      false,
      "no installment path without an established amount",
    );
    assert.equal(result.facts.user_reported_goal, "I need to know what I owe and what to do.");
  }

  {
    const doc = readFileSync(join(root, "docs/v5.1/PACKAGE-A-EVIDENCE-PROPORTIONAL.md"), "utf8");
    assert.match(doc, /USER_REPORTED_GOAL|evidence-proportional/i);
    const guide = readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8");
    assert.match(guide, /Depth must be proportional to evidence/i);
  }

  console.log("phase-package-a-honesty-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
