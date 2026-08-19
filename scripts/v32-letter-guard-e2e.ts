import Module from "node:module";
import assert from "node:assert";

/**
 * Proves the safety property end to end: a response letter that states a figure
 * the evidence does not establish never reaches the customer.
 *
 * The real code path runs — prompt composition, provider selection, response
 * parsing, the guard, the correction retry, and the fallback. Only the outbound
 * HTTP call is stubbed, because the guard's job is to judge what a model
 * returns, and that requires controlling exactly what it returns.
 */
const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

const TRANSCRIPT_2023 = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2023
ACCOUNT BALANCE: 2,879.00
AS OF: Mar. 10, 2026
150 Tax return filed 04-15-2024 $5,000.00
806 W-2 withholding 04-15-2024 -$7,879.00
846 Refund issued 05-10-2024 -$427.93`;

const FABRICATED_DRAFT = `[DATE]

Internal Revenue Service

Re: Tax year 2023

Your records show a balance of $9,100.00 for tax year 2023, which I dispute.

Sincerely,
[YOUR NAME]`;

const GROUNDED_DRAFT = `[DATE]

Internal Revenue Service

Re: Tax year 2023

Your records show a balance of $2,879.00 for tax year 2023, which I dispute.

Sincerely,
[YOUR NAME]`;

type Scripted = { replies: string[]; prompts: string[] };
const scripted: Scripted = { replies: [], prompts: [] };

function installProviderStub() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes("/chat/completions")) return realFetch(input as RequestInfo, init);
    scripted.prompts.push(String(init?.body ?? ""));
    const reply = scripted.replies.shift() ?? GROUNDED_DRAFT;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: reply } }],
        usage: { prompt_tokens: 100, completion_tokens: 100 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof globalThis.fetch;
}

async function main() {
  installProviderStub();
  const db = (await import("../src/lib/db")).db;
  const { compileCaseEvidence } = await import("../src/lib/evidence/compile");
  const { generateLetterDraft } = await import("../src/lib/ai/orchestrator");

  const email = `v32-letter-${Date.now()}@example.com`;
  let userId: string | null = null;
  let providerId: string | null = null;
  const originalProviderByStepId = new Map<string, string>();

  try {
    const user = await db.user.create({ data: { email, role: "user", status: "active" } });
    userId = user.id;
    const c = await db.case.create({
      data: {
        userId: user.id,
        title: "v3.2 letter guard check",
        situation: "The IRS says I owe money for 2023.",
        goal: "Dispute the balance.",
        status: "analyzed",
      },
    });
    await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "account-transcript-2023.pdf",
        filePath: "letter-guard-1.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: `letter-guard-${Date.now()}`,
        extractedJson: JSON.stringify({ raw_text: TRANSCRIPT_2023 }),
      },
    });
    await compileCaseEvidence(c.id);

    // A provider the policy permits, pointed at the stubbed endpoint.
    const provider = await db.aiProvider.create({
      data: {
        name: `Letter guard stub ${Date.now()}`,
        kind: "openai_compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "stub-key-for-guard-check",
        model: "stub-model",
        isEnabled: true,
        dataRetentionProfile: "approved_no_training",
        regionProfile: "approved_us",
      },
    });
    providerId = provider.id;

    // The real letter steps run, with only their provider swapped for the stub,
    // so the configured prompts and composition are exercised as shipped.
    const realSteps = await db.pipelineStep.findMany({ where: { stageKey: "letter", isEnabled: true } });
    for (const step of realSteps) {
      originalProviderByStepId.set(step.id, step.providerId);
      await db.pipelineStep.update({ where: { id: step.id }, data: { providerId: provider.id } });
    }
    await db.pipelineStage.update({ where: { key: "letter" }, data: { isEnabled: true } });
    const stepsPerDraft = realSteps.length;

    const context = "I want to dispute the balance the IRS says I owe for 2023.";

    // Every step in the stage calls the model, so a single draft costs one
    // call per step. The last step's output is the draft that is returned.
    const draftPass = (final: string) => Array(Math.max(1, stepsPerDraft - 1)).fill(final).concat([final]);

    // 1. A grounded draft is returned untouched, with no correction pass.
    scripted.replies = draftPass(GROUNDED_DRAFT);
    scripted.prompts = [];
    const grounded = await generateLetterDraft(context, c.id);
    assert.match(grounded, /\$2,879\.00/, "a draft built on the transcript must be delivered");
    assert.equal(scripted.prompts.length, stepsPerDraft, "a grounded draft needs no correction pass");
    assert.ok(
      scripted.prompts.some((p) => p.includes("2,879")),
      "the evidence must actually reach the model",
    );

    // 2. A fabricated figure triggers one targeted correction pass, and the
    //    corrected draft is what the customer receives.
    scripted.replies = [...draftPass(FABRICATED_DRAFT), ...draftPass(GROUNDED_DRAFT)];
    scripted.prompts = [];
    const corrected = await generateLetterDraft(context, c.id);
    assert.equal(scripted.prompts.length, stepsPerDraft * 2, "an unsupported figure must be sent back for correction");
    assert.ok(
      scripted.prompts.slice(stepsPerDraft).some((p) => p.includes("9,100")),
      "the correction must name the figure it rejected",
    );
    assert.ok(!corrected.includes("$9,100.00"), "the fabricated figure must not survive");
    assert.match(corrected, /\$2,879\.00/, "the corrected draft is delivered");

    // 3. A model that will not correct itself never reaches the customer.
    scripted.replies = [...draftPass(FABRICATED_DRAFT), ...draftPass(FABRICATED_DRAFT)];
    scripted.prompts = [];
    const refused = await generateLetterDraft(context, c.id);
    assert.equal(scripted.prompts.length, stepsPerDraft * 2, "exactly one correction attempt is made");
    assert.ok(!refused.includes("$9,100.00"), "an uncorrected fabrication must never be shown to the customer");
    assert.match(refused, /\[YOUR NAME\]|\[DATE\]/, "the customer falls back to the deterministic template");

    const logged = await db.systemLog.findFirst({
      where: { message: "Response letter draft stated unverified amounts" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(logged, "a rejected draft must be recorded, not silently dropped");
    assert.match(String(logged?.detail ?? ""), /9100/, "the record must name the offending figure");

    // 4. Without a case there is no evidence, so the customer's own words are
    //    the only ground — an invented figure is still refused.
    scripted.replies = [...draftPass(FABRICATED_DRAFT), ...draftPass(FABRICATED_DRAFT)];
    scripted.prompts = [];
    const ungrounded = await generateLetterDraft(context);
    assert.ok(!ungrounded.includes("$9,100.00"), "an ungrounded letter must not state an invented balance");

    console.log("v3.2 letter guard e2e passed — grounded draft delivered, fabricated figure corrected, uncorrected fabrication withheld and logged");
  } finally {
    for (const [id, providerIdOriginal] of originalProviderByStepId) {
      await db.pipelineStep.update({ where: { id }, data: { providerId: providerIdOriginal } }).catch(() => undefined);
    }
    if (providerId) await db.aiProvider.delete({ where: { id: providerId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
