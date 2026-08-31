/**
 * Phase C — three locks (tax matter isolation).
 * Run: npx tsx scripts/phase-c-locks-check.ts
 */
import assert from "node:assert/strict";
import {
  detectNew1040ContaminationRisk,
  filterByRetrievalLock,
  isCollectionsLevyLock,
  matterTypeLockFromBrief,
  passesPresentationLock,
  passesRecommendationLock,
  passesRetrievalLock,
  scrubPresentationContamination,
  shouldEmitAntiNew1040,
  scopeInquiryThemes,
} from "../src/lib/matter-type-lock";
import { LEVY_FIXTURE, lockFromFixture, CP2000_FIXTURE } from "../src/lib/v51-fixture-pack";

const levyLock = lockFromFixture(LEVY_FIXTURE);
assert.ok(levyLock);
assert.ok(isCollectionsLevyLock(levyLock));
assert.equal(levyLock!.doNotRecommendNewPathway, true);

assert.equal(passesRetrievalLock("How installment agreements work for levy", levyLock), true);
assert.equal(passesRetrievalLock("Schedule C audit workbook for exam education", levyLock), false);
assert.equal(passesPresentationLock("Pay via installment agreement", levyLock), true);
assert.equal(passesPresentationLock("Next: file a new Form 1040 first", levyLock), false);
assert.equal(passesRecommendationLock("Do not file a new Form 1040 first — address the levy", levyLock), true);
assert.equal(passesRecommendationLock("You should file a new Form 1040 first", levyLock), false);

const scrubbed = scrubPresentationContamination("A. file a new Form 1040 first. B. pay.");
assert.ok(!scrubbed.includes("file a new Form 1040 first"));

const themes = scopeInquiryThemes(["installment", "audit_exam_education", "schedule_c_audit"], levyLock);
assert.ok(themes.includes("installment"));
assert.ok(!themes.includes("audit_exam_education"));

assert.equal(
  shouldEmitAntiNew1040({
    lock: levyLock,
    hasNew1040ContaminationRisk: detectNew1040ContaminationRisk(["maybe file a new Form 1040"]),
  }),
  true,
);

const filtered = filterByRetrievalLock(
  ["levy relief", "Schedule C audit workbook"],
  levyLock,
  (s) => s,
);
assert.deepEqual(filtered, ["levy relief"]);

const cpLock = lockFromFixture(CP2000_FIXTURE);
assert.equal(
  passesRecommendationLock("start with an offer in compromise before responding to the CP2000", cpLock),
  false,
);

assert.equal(matterTypeLockFromBrief({}), null);

console.log("phase-c-locks-check: ok");
