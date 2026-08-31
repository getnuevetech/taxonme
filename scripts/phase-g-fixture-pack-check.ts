/**
 * Phase G — multi-fixture pack isolation (tax).
 * Run: npx tsx scripts/phase-g-fixture-pack-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateApprovalGate } from "../src/lib/approval-gate";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import { classifyDocument } from "../src/lib/evidence/classify";
import {
  passesPresentationLock,
  passesRecommendationLock,
  passesRetrievalLock,
} from "../src/lib/matter-type-lock";
import {
  V51_FIXTURE_PACK,
  lockFromFixture,
  sampleCustomerText,
} from "../src/lib/v51-fixture-pack";

assert.ok(V51_FIXTURE_PACK.length >= 8);
assert.ok(V51_FIXTURE_PACK.some((f) => f.kind === "positive"));
assert.ok(V51_FIXTURE_PACK.some((f) => f.kind === "negative"));

for (const fixture of V51_FIXTURE_PACK) {
  const lock = lockFromFixture(fixture.input);
  if (fixture.isolation.primary_module) {
    assert.equal(lock?.primaryModule, fixture.isolation.primary_module);
  }
  if (fixture.isolation.do_not_recommend_new_pathway != null) {
    assert.equal(lock?.doNotRecommendNewPathway, fixture.isolation.do_not_recommend_new_pathway);
  }

  const clean = sampleCustomerText(fixture, false);
  for (const re of fixture.isolation.must_allow ?? []) {
    assert.match(clean, re, `${fixture.id} must_allow ${re}`);
  }

  const contaminated = sampleCustomerText(fixture, true);
  for (const re of fixture.isolation.must_forbid ?? []) {
    // Contaminated sample is crafted to include at least one forbid pattern for locked fixtures.
    if (re.test(contaminated)) {
      assert.equal(
        passesPresentationLock(contaminated, lock) && passesRecommendationLock(contaminated, lock),
        false,
        `${fixture.id} contaminated text must fail a lock for ${re}`,
      );
    }
  }

  // Negative fixtures: clean text must not include forbid patterns.
  if (fixture.kind === "negative") {
    for (const re of fixture.isolation.must_forbid ?? []) {
      assert.doesNotMatch(clean, re, `${fixture.id} clean text must not include ${re}`);
    }
  }

  for (const doc of fixture.input.documents ?? []) {
    const classified = classifyDocument({
      fileName: doc.fileName,
      text: doc.text ?? "",
      docKind: "other",
    });
    if (doc.documentType) {
      assert.equal(classified.documentType, doc.documentType, `${fixture.id} ${doc.fileName}`);
    }
  }

  const ledger = buildFactLedger({
    situation: fixture.input.situation,
    goal: fixture.input.goal,
    documents: (fixture.input.documents ?? []).map((d, i) => ({
      id: `${fixture.id}-${i}`,
      fileName: d.fileName,
      documentType: d.documentType,
      text: d.text,
    })),
  });
  assert.ok(ledger.version === 1);

  if (fixture.kind === "positive" && fixture.input.documents?.length) {
    const gate = evaluateApprovalGate({
      lock,
      documents: (fixture.input.documents ?? []).map((d) => ({
        fileName: d.fileName,
        documentType: d.documentType,
        contentHash: d.fileName,
      })),
      factLedger: ledger,
      customerText: clean,
      documentCount: fixture.input.documents?.length ?? 0,
    });
    assert.notEqual(gate.gate_result, "BLOCK", `${fixture.id} clean path should not BLOCK: ${gate.reasons.join("; ")}`);
  }
}

{
  const golden = JSON.parse(
    readFileSync(join(process.cwd(), "docs/v5.1/golden-cp2000-transcript.json"), "utf8"),
  );
  assert.equal(golden.domain, "tax");
  assert.ok(Array.isArray(golden.must_forbid_customer_copy));
  assert.ok(!JSON.stringify(golden).match(/I-360|VAWA|USCIS/i));
}

console.log("phase-g-fixture-pack-check: ok");
