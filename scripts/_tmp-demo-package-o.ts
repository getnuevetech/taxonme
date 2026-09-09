import Module from "node:module";
const m = Module as unknown as { _load: (...args: unknown[]) => unknown };
const o = m._load;
m._load = function (r: unknown, ...a: unknown[]) {
  if (r === "server-only") return {};
  return o.call(this, r, ...a);
};

async function main() {
  const { sanitizeThinPresenterIssues } = await import("../src/lib/ai/presenter-honesty");
  const speculative = {
    issue_type: "balance_due",
    item_kind: "issue",
    evidence_status: "possible",
    title: "Installment agreement and First-Time Abatement options",
    what_we_know: "You may owe; FTA and installment agreement above $50,000 may apply.",
    our_conclusion: "Start a payment plan.",
    explanations: [{ title: "Underwithholding", detail: "Speculative", likelihood: "Likely" }],
    analysis_outline: [{ heading: "Tax rules", detail: "Generic FTA text" }],
    expected_amount: null,
  };
  const before = JSON.stringify(speculative, null, 2);
  const after = sanitizeThinPresenterIssues([speculative], {
    hasDocs: false,
    hasTranscript: false,
    hasAmount: false,
    hasTaxYear: false,
  });
  console.log("=== BEFORE (speculative AI presenter card) ===");
  console.log(before);
  console.log("\n=== AFTER sanitizeThinPresenterIssues (Package O) ===");
  console.log(JSON.stringify(after.issues[0], null, 2));
  console.log("\nsanitized=", after.sanitized);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
