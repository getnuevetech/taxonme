import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type ChatMessage } from "./adapters";
import { mergeStructured, computeReadiness, type Conflict } from "./consensus";
import { fallbackAnalyze } from "./fallback";
import { STAGE_KEYS } from "../constants";
import { getNumberSetting } from "../settings";
import { readUpload } from "../uploads";
import { verifyCaseProgress } from "../case-progress";

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

// ---------- Full case analysis pipeline (Layers 1–5) ----------

// Extract readable text from an uploaded document where possible (plain-text
// formats). Binary formats (PDF scans, photos) require a vision-capable AI
// provider; until one is configured we analyze filename + kind + user input.
async function getDocumentText(doc: { filePath: string; fileName: string; mimeType: string }): Promise<string> {
  const textLike =
    doc.mimeType.startsWith("text/") ||
    /\.(txt|csv|md|log)$/i.test(doc.fileName) ||
    doc.mimeType === "application/json";
  if (!textLike) return "";
  try {
    const buf = await readUpload(doc.filePath);
    return buf.toString("utf-8").slice(0, 12000);
  } catch {
    return "";
  }
}

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

  // Layer 2 input: include actual document content where it can be read.
  const docParts: string[] = [];
  let rawDocText = "";
  for (const d of c.documents) {
    const content = await getDocumentText(d);
    if (content && !d.extractedJson) {
      await db.document.update({
        where: { id: d.id },
        data: { extractedJson: JSON.stringify({ raw_text: content.slice(0, 4000) }), status: "extracted" },
      });
    }
    rawDocText += content ? `\n${content}` : "";
    docParts.push(
      `Document: ${d.fileName} (kind: ${d.docKind})${content ? `\nContent:\n${content}` : d.extractedJson ? `\nExtracted: ${d.extractedJson}` : ""}`,
    );
  }
  const docText = docParts.join("\n\n");

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
  const docInfos = c.documents.map((d) => ({
    docKind: d.docKind,
    readable:
      d.mimeType.startsWith("text/") ||
      /\.(txt|csv|md|log)$/i.test(d.fileName) ||
      d.extractedJson.length > 0,
  }));
  const fallback = usedAi ? null : await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos);
  const facts = usedAi ? summaryOut.merged : fallback!.facts;
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
    : (fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos))).issues;

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

  // Path forward steps (each carries an action key for evidence verification).
  const pathSteps: Json[] = presentation?.path_steps
    ? ((presentation.path_steps as Json[]) ?? [])
    : ((fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos))).pathSteps as unknown as Json[]);
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
    // AI auto-assignment (admin-controlled; both parties still consent).
    const { autoAssignConsultant } = await import("../matching");
    await autoAssignConsultant(caseId).catch(() => false);
  }

  // Immediately verify path-step evidence (e.g. documents already uploaded at intake).
  await verifyCaseProgress(caseId);
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
