import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type ChatMessage } from "./adapters";
import { mergeStructured, computeReadiness, type Conflict } from "./consensus";
import { STAGE_KEYS } from "../constants";
import { getNumberSetting } from "../settings";

type Json = Record<string, unknown>;

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function getRunnableSteps(stageKey: string) {
  const stage = await db.pipelineStage.findUnique({
    where: { key: stageKey },
    include: {
      steps: {
        where: { isEnabled: true },
        orderBy: { sortOrder: "asc" },
        include: { provider: true },
      },
    },
  });
  if (!stage?.isEnabled) return [];
  return stage.steps.filter((s) => s.provider.isEnabled && s.provider.apiKey.length > 0);
}

// Naive keyword retrieval over the admin-curated IRS knowledge base.
export async function retrieveKnowledge(query: string, limit = 5): Promise<string> {
  const sources = await db.knowledgeSource.findMany({ where: { isActive: true } });
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3),
    ),
  );
  const scored = sources
    .map((s) => {
      const hay = `${s.title} ${s.reference} ${s.tags} ${s.content}`.toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score++;
      // Notice codes like CP2000 are strong signals.
      const codes = query.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}\b/g) ?? [];
      for (const c of codes) if (hay.toUpperCase().includes(c.replace(/\s|-/g, ""))) score += 10;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored
    .map(({ s }) => `[${s.reference || s.sourceType}] ${s.title}\n${s.content.slice(0, 2500)}`)
    .join("\n\n---\n\n");
}

export type StageOutcome = {
  stepOutputs: { source: string; role: string; data: Json | null; rawText: string }[];
  merged: Json;
  conflicts: Conflict[];
  usedAi: boolean;
};

/**
 * Run one pipeline stage: every enabled step (each an admin-selected provider
 * with an admin-editable prompt and responsibility) runs on the same input,
 * then the consensus engine merges results and flags disagreements.
 */
export async function runStage(
  stageKey: string,
  vars: Record<string, string>,
  opts?: { runId?: string; sequentialContext?: boolean },
): Promise<StageOutcome> {
  const steps = await getRunnableSteps(stageKey);
  const stepOutputs: StageOutcome["stepOutputs"] = [];
  let prior = "";

  for (const step of steps) {
    const prompt = fill(step.promptTemplate, { ...vars, prior });
    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const started = Date.now();
    try {
      const result = await callProvider(step.provider, messages);
      const data = extractJson(result.text);
      stepOutputs.push({
        source: `${step.provider.name} (${step.role})`,
        role: step.role,
        data,
        rawText: result.text,
      });
      if (opts?.sequentialContext) prior += `\n\n[${step.role}]\n${result.text}`;
      if (opts?.runId) {
        await db.analysisStepResult.create({
          data: {
            runId: opts.runId,
            providerId: step.providerId,
            roleKey: step.role,
            status: "complete",
            rawText: result.text.slice(0, 20000),
            parsedJson: data ? JSON.stringify(data) : "",
            latencyMs: result.latencyMs,
          },
        });
      }
    } catch (err) {
      if (opts?.runId) {
        await db.analysisStepResult.create({
          data: {
            runId: opts.runId,
            providerId: step.providerId,
            roleKey: step.role,
            status: "failed",
            rawText: String(err).slice(0, 2000),
            latencyMs: Date.now() - started,
          },
        });
      }
    }
  }

  const structured = stepOutputs.filter((o) => o.data);
  const { merged, conflicts } = mergeStructured(
    structured.map((o) => ({ source: o.source, data: o.data as Json })),
  );
  return { stepOutputs, merged, conflicts, usedAi: stepOutputs.length > 0 };
}

// ---------- Deterministic fallback (no AI keys configured yet) ----------
// Keeps the product functional before the admin connects providers; every
// result is labeled so the UI can show that AI verification is pending.

function fallbackFacts(situation: string, goal: string): Json {
  const text = `${situation}\n${goal}`;
  const years = Array.from(new Set(text.match(/\b(19|20)\d{2}\b/g) ?? [])).map(Number).filter((y) => y > 1990 && y < 2100);
  const amounts = (text.match(/\$\s?[\d,]+(?:\.\d{2})?/g) ?? []).map((a) => Number(a.replace(/[$,\s]/g, "")));
  const notices = Array.from(new Set((text.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}\b/g) ?? []).map((c) => c.replace(/\s|-/g, ""))));
  return {
    tax_years: years,
    amounts_mentioned: amounts,
    notices_received: notices,
    user_goal: goal,
    unknowns: ["AI providers not yet configured — automated extraction pending"],
  };
}

function fallbackIssues(situation: string, goal: string): Json[] {
  const text = `${situation} ${goal}`.toLowerCase();
  const issues: Json[] = [];
  const push = (issue_type: string, title: string, description: string) =>
    issues.push({ issue_type, title, what_we_know: description, what_we_dont_know: "Detailed verification requires document analysis.", confidence: "low", priority: "medium", state: "info_needed", next_action: "UPLOAD_DOCUMENTS" });
  if (/refund/.test(text)) push("refund_discrepancy", "Possible refund issue", "Your summary mentions a refund. We need your return and account transcript to verify amounts.");
  if (/(owe|balance|debt|due)/.test(text)) push("balance_due", "Possible balance due", "Your summary mentions owing the IRS. We need notices or transcripts to confirm the balance.");
  if (/(penalt|interest)/.test(text)) push("penalty", "Possible penalties or interest", "Penalty relief may be available depending on your history and circumstances.");
  if (/(notice|letter|cp\d|lt\d)/.test(text)) push("notice_response", "IRS notice mentioned", "Upload the notice so we can identify its type, amount, and deadline.");
  if (/(didn'?t file|not filed|unfiled|late filing|missed filing)/.test(text)) push("missing_return", "Possible unfiled return", "Unfiled returns usually need to be filed before other resolutions are available.");
  if (issues.length === 0) push("other", "Tax situation review", "We recorded your summary and goal. Upload supporting documents so we can analyze the details.");
  return issues;
}

// ---------- Full case analysis pipeline (Layers 1–5) ----------

export async function runCaseAnalysis(caseId: string): Promise<void> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { documents: { where: { deletedAt: null } } },
  });
  if (!c) return;
  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });

  // Clear previous results for a clean re-run.
  await db.issue.deleteMany({ where: { caseId } });
  await db.pathStep.deleteMany({ where: { caseId } });

  const docText = c.documents
    .map((d) => `Document: ${d.fileName} (kind: ${d.docKind})${d.extractedJson ? `\nExtracted: ${d.extractedJson}` : ""}`)
    .join("\n\n");

  async function stageRun(stageKey: string, vars: Record<string, string>, sequentialContext = false) {
    const run = await db.analysisRun.create({ data: { caseId, stageKey, status: "running" } });
    const outcome = await runStage(stageKey, vars, { runId: run.id, sequentialContext });
    await db.analysisRun.update({
      where: { id: run.id },
      data: { status: "complete", finishedAt: new Date() },
    });
    await db.consensusResult.create({
      data: {
        runId: run.id,
        mergedJson: JSON.stringify(outcome.merged),
        conflictsJson: JSON.stringify(outcome.conflicts),
        verificationRequired: outcome.conflicts.length > 0,
      },
    });
    return outcome;
  }

  // Layer 2/3: summary, goal, and document analysis (multi-model, admin-selected).
  const summaryOut = await stageRun(STAGE_KEYS.SUMMARY, { input: c.situation }, true);
  const goalOut = await stageRun(STAGE_KEYS.GOAL, { input: c.goal }, true);
  const documentOut = c.documents.length
    ? await stageRun(STAGE_KEYS.DOCUMENT, { input: docText })
    : null;

  const usedAi = summaryOut.usedAi || goalOut.usedAi || (documentOut?.usedAi ?? false);
  const facts = usedAi ? summaryOut.merged : fallbackFacts(c.situation, c.goal);
  const goalFacts = usedAi ? goalOut.merged : { user_goal: c.goal };

  // Layer 4: situation analysis grounded in the IRS knowledge base.
  const knowledge = await retrieveKnowledge(`${c.situation} ${c.goal} ${docText}`);
  let situationMerged: Json = {};
  let situationConflicts: Conflict[] = [];
  if (usedAi) {
    const situationOut = await stageRun(STAGE_KEYS.SITUATION, {
      facts: JSON.stringify(facts),
      documents: documentOut ? JSON.stringify(documentOut.merged) : "(no documents uploaded)",
      knowledge: knowledge || "(no matching reference material)",
      goal: JSON.stringify(goalFacts),
    });
    situationMerged = situationOut.merged;
    situationConflicts = situationOut.conflicts;
  }

  // Layer 5 presentation: a single AI converts internal analysis to structured
  // data; the UI renders it deterministically. Falls back to rule-based output.
  let presentation: Json | null = null;
  if (usedAi) {
    const presenterOut = await stageRun(STAGE_KEYS.PRESENTER, {
      input: JSON.stringify({ facts, goal: goalFacts, documents: documentOut?.merged ?? null, analysis: situationMerged }),
    });
    const p = presenterOut.stepOutputs.find((o) => o.data)?.data ?? null;
    presentation = p && Array.isArray((p as Json).issues) ? (p as Json) : null;
  }
  const issues: Json[] = presentation
    ? ((presentation.issues as Json[]) ?? [])
    : fallbackIssues(c.situation, c.goal);

  // Persist issues.
  for (const [i, issue] of issues.entries()) {
    const toCents = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : null);
    await db.issue.create({
      data: {
        caseId,
        issueType: String(issue.issue_type ?? "other"),
        taxYear: typeof issue.tax_year === "number" ? issue.tax_year : null,
        title: String(issue.title ?? issue.issue_identified ?? `Issue ${i + 1}`).slice(0, 200),
        description: [issue.what_we_know, issue.what_we_dont_know ? `What we don't know yet: ${issue.what_we_dont_know}` : ""].filter(Boolean).join("\n\n"),
        expectedCents: toCents(issue.expected_amount),
        receivedCents: toCents(issue.received_amount),
        differenceCents: toCents(issue.difference_amount),
        confidence: ["high", "medium", "low"].includes(String(issue.confidence)) ? String(issue.confidence) : "medium",
        priority: ["urgent", "high", "medium", "low"].includes(String(issue.priority)) ? String(issue.priority) : "medium",
        state: ["resolved", "review", "action_needed", "urgent", "info_needed"].includes(String(issue.state)) ? String(issue.state) : "review",
        nextAction: String(issue.next_action ?? ""),
        irsBasis: String(issue.irs_basis ?? ""),
      },
    });
  }

  // Path forward steps.
  const pathSteps: Json[] = presentation?.path_steps
    ? ((presentation.path_steps as Json[]) ?? [])
    : [
        { title: "Upload your supporting documents", description: "Add your return, notices, W-2/1099s, and any IRS letters to your vault." },
        { title: "Get your IRS account transcript", description: "Your transcript shows exactly what the IRS has on file. We guide you through getting it." },
        { title: "Review your verified analysis", description: "Once documents are in, we re-run the analysis and confirm every amount." },
        { title: "Follow your resolution steps", description: "We break the fix into simple steps and track your deadlines." },
      ];
  for (const [i, step] of pathSteps.entries()) {
    await db.pathStep.create({
      data: {
        caseId,
        sortOrder: i,
        title: String(step.title ?? `Step ${i + 1}`).slice(0, 200),
        description: String(step.description ?? ""),
        actionKey: String(step.action_key ?? ""),
        status: i === 0 ? "current" : "pending",
      },
    });
  }

  // Deterministic readiness score (our formula, not an AI's opinion).
  const unknowns = Array.isArray(facts.unknowns) ? (facts.unknowns as unknown[]).length : 0;
  const allConflicts = [...summaryOut.conflicts, ...goalOut.conflicts, ...(documentOut?.conflicts ?? []), ...situationConflicts];
  const expectedDocs = await getNumberSetting("analysis.expected_documents", 3);
  const factKeys = Object.keys(facts).filter((k) => k !== "unknowns");
  const verifiedFacts = factKeys.filter((k) => {
    const v = facts[k];
    return v !== null && v !== "" && !(typeof v === "object" && v !== null && (v as Json).__conflict);
  }).length;
  const readiness = computeReadiness({
    documentsCount: c.documents.length,
    documentsExpected: expectedDocs,
    factsVerified: verifiedFacts,
    factsTotal: Math.max(factKeys.length, 1),
    irsSourcesMatched: knowledge ? Math.min(3, knowledge.split("---").length) : 0,
    unresolvedConflicts: allConflicts.length,
    unknowns,
  });

  // Consultant recommendation → notify admins.
  const needsConsultant =
    presentation?.consultant_recommended === true ||
    issues.some((i) => String(i.professional_review ?? "") === "required");
  await db.case.update({
    where: { id: caseId },
    data: {
      status: needsConsultant ? "consultant_recommended" : "analyzed",
      readinessScore: readiness,
    },
  });
  if (needsConsultant) {
    const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          kind: "consultant_needed",
          title: "A case needs a consultant",
          body: `Case "${c.title}" was flagged for professional review. Recommend a consultant to the user.`,
          link: `/admin/assignments?case=${caseId}`,
        },
      });
    }
  }
}

// ---------- Single-purpose AI helpers ----------

export async function runQaChat(history: { role: string; content: string }[]): Promise<string> {
  const steps = await getRunnableSteps(STAGE_KEYS.QA);
  const convo = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const knowledge = await retrieveKnowledge(history.map((m) => m.content).join(" "));
  if (steps.length === 0) {
    return "Our AI assistant isn't connected yet — the administrator needs to add an AI provider in the admin backend. Meanwhile, you can upload your documents to your vault and browse the guides, and we'll analyze everything as soon as the assistant is online.";
  }
  const step = steps[0];
  const prompt = fill(step.promptTemplate, { input: convo, knowledge: knowledge || "(none)" });
  const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
  return result.text;
}

export async function explainNoticeContent(content: string): Promise<Json | null> {
  const outcome = await runStage(STAGE_KEYS.NOTICE, { input: content });
  const parsed = outcome.stepOutputs.find((o) => o.data)?.data ?? null;
  if (parsed) return parsed;
  // Deterministic fallback: identify notice code and match knowledge base.
  const code = (content.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}\b/) ?? [])[0]?.replace(/\s|-/g, "") ?? "";
  const kb = code
    ? await db.knowledgeSource.findFirst({ where: { reference: { contains: code }, isActive: true } })
    : null;
  return {
    notice_type: code || null,
    plain_english_explanation: kb
      ? kb.content.slice(0, 1200)
      : "We stored your notice safely. Automated explanation requires the administrator to connect an AI provider — or our team's knowledge base doesn't cover this notice type yet.",
    next_steps: [
      { title: "Keep the notice safe", description: "It's stored in your document vault." },
      { title: "Check the deadline", description: "IRS notices usually show a respond-by date near the top right. Add it to your deadlines." },
    ],
    urgency: "medium",
    fallback: true,
  };
}

export async function generateLetterDraft(context: string): Promise<string> {
  const steps = await getRunnableSteps(STAGE_KEYS.LETTER);
  if (steps.length === 0) {
    return `[DATE]

Internal Revenue Service
[IRS ADDRESS FROM YOUR NOTICE]

Re: [NOTICE NUMBER] — Tax Year [YEAR]
Taxpayer: [YOUR NAME]
SSN: XXX-XX-[LAST 4]

To Whom It May Concern:

I am writing in response to the notice referenced above.

[Describe your situation here: ${context.slice(0, 300)}]

I respectfully request that you review the enclosed documentation and update my account accordingly. Please contact me at the address or phone number below if you need any additional information.

Sincerely,

[YOUR NAME]
[YOUR ADDRESS]
[YOUR PHONE]

Enclosures: [LIST YOUR DOCUMENTS]`;
  }
  const step = steps[0];
  const prompt = fill(step.promptTemplate, { input: context });
  const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
  return result.text;
}
