/**
 * Package AO — Fallback / Case notice agree–disagree honesty.
 * Run: npx tsx scripts/phase-package-ao-check.ts
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
  const root = process.cwd();
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");

  const thin = await fallbackAnalyze(
    "I got a CP503 for 2022",
    "Help",
    "",
    [],
  );
  const thinBlob = JSON.stringify(thin);
  assert.doesNotMatch(thinBlob, /agree, partially agree, or disagree/i);
  assert.doesNotMatch(thinBlob, /You can agree/i);
  assert.doesNotMatch(thinBlob, /If you disagree with a notice/i);

  const noticeIssue = thin.issues.find((i) => i.issue_type === "notice_response") as {
    still_unclear?: string[];
    next_action?: string;
    analysis_outline?: { heading: string; detail: string }[];
  };
  assert.ok(noticeIssue);
  assert.match(
    (noticeIssue.still_unclear ?? []).join(" "),
    /Account Transcript|printed amounts|sizing a written response/i,
  );
  assert.notEqual(noticeIssue.next_action, "DRAFT_LETTER");
  const conclusion =
    noticeIssue.analysis_outline?.find((x) => x.heading === "Our conclusion")?.detail ?? "";
  assert.match(conclusion, /Account Transcript|respond-by|printed amount/i);
  assert.doesNotMatch(conclusion, /You can agree/i);

  assert.equal(
    thin.pathSteps.some((s) => /Draft your response letter/i.test(s.title)),
    false,
    "thin notice without doc must not open draft-letter path",
  );
  assert.equal(
    thin.pathSteps.some((s) => /Confirm the resolution/i.test(s.title)),
    false,
    "thin notice without doc must not open confirm-resolution",
  );

  const withNotice = await fallbackAnalyze(
    "I got a CP503 for 2022",
    "Help",
    "",
    [{ docKind: "notice", readable: true, documentType: "notice", fileName: "cp503.pdf" }],
  );
  const withBlob = JSON.stringify(withNotice);
  assert.doesNotMatch(withBlob, /agree, partially agree, or disagree/i);
  assert.doesNotMatch(withBlob, /You can agree/i);
  const withIssue = withNotice.issues.find((i) => i.issue_type === "notice_response") as {
    next_action?: string;
  };
  assert.equal(withIssue?.next_action, "DRAFT_LETTER");
  const draft = withNotice.pathSteps.find((s) => /Draft your response letter/i.test(s.title));
  assert.ok(draft);
  assert.match(draft.description, /Account Transcript|not the same as IRS acceptance/i);
  assert.doesNotMatch(draft.description, /If you disagree with a notice/i);

  const src = readFileSync(join(root, "src/lib/ai/fallback.ts"), "utf8");
  assert.match(src, /Package AO/);
  assert.doesNotMatch(src, /Whether you agree, partially agree, or disagree with what the notice states/);
  assert.doesNotMatch(src, /You can agree, partially agree, or disagree\./);
  assert.doesNotMatch(src, /If you disagree with a notice, the IRS expects/);
  // Refund-offset agree wording preserved (different meaning).
  assert.match(src, /agree with the underlying balance/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AO-FALLBACK-NOTICE-AGREE-DISAGREE-HONESTY.md"), "utf8"),
    /Package AO/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AO\*\*.*fallback|agree/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ao"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ao/);

  console.log("phase-package-ao-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
