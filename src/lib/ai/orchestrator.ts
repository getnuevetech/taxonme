import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type ChatMessage, type MediaAttachment } from "./adapters";
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
  opts?: { runId?: string; sequentialContext?: boolean; media?: MediaAttachment[] },
): Promise<StageOutcome> {
  const steps = await getRunnableSteps(stageKey);
  const stepOutputs: StageOutcome["stepOutputs"] = [];
  let prior = "";

  for (const step of steps) {
    const prompt = fill(step.promptTemplate, { ...vars, prior });
    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const started = Date.now();
    try {
      const result = await callProvider(step.provider, messages, opts?.media ?? []);
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
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed in stage "${stageKey}" (${step.role})`, String(err));
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

// Extract readable text from an uploaded document: plain-text formats
// directly, and digital PDFs (like IRS transcripts downloaded from the online
// account) via their embedded text layer. Scanned PDFs and photos have no
// text layer — they go to vision-capable providers as media instead.
async function getDocumentText(doc: { filePath: string; fileName: string; mimeType: string }): Promise<string> {
  const textLike =
    doc.mimeType.startsWith("text/") ||
    /\.(txt|csv|md|log)$/i.test(doc.fileName) ||
    doc.mimeType === "application/json";
  const isPdf = doc.mimeType === "application/pdf" || /\.pdf$/i.test(doc.fileName);
  try {
    const buf = await readUpload(doc.filePath);
    if (textLike) return buf.toString("utf-8").slice(0, 12000);
    if (isPdf) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
          const result = await parser.getText();
          const text = String(result?.text ?? "").replace(/\u0000/g, "").trim();
          if (text.length > 80) return text.slice(0, 15000);
        } finally {
          await parser.destroy().catch(() => null);
        }
      } catch (err) {
        // Scanned PDFs legitimately have no text layer; anything else (like a
        // broken import) must be visible in the system log, never silent.
        const { logSystem } = await import("../syslog");
        await logSystem("warning", "pdf_extract", `Could not extract text from ${doc.fileName}`, String(err));
      }
    }
  } catch {
    return "";
  }
  return "";
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

  // Layer 2 input: include actual document content where it can be read
  // (plain text + the text layer of digital PDFs, e.g. IRS transcripts).
  const docParts: string[] = [];
  let rawDocText = "";
  const readableDocIds = new Set<string>();
  for (const d of c.documents) {
    const content = await getDocumentText(d);
    if (content) {
      readableDocIds.add(d.id);
      if (!d.extractedJson) {
        await db.document.update({
          where: { id: d.id },
          data: { extractedJson: JSON.stringify({ raw_text: content.slice(0, 4000) }), status: "extracted" },
        });
      }
    }
    rawDocText += content ? `\n${content}` : "";
    docParts.push(
      `Document: ${d.fileName} (kind: ${d.docKind})${content ? `\nContent:\n${content}` : d.extractedJson ? `\nExtracted: ${d.extractedJson}` : "\n(scanned/photographed — see the attached file)"}`,
    );
  }
  const docText = docParts.join("\n\n");

  // Media for vision-capable providers: PDFs and images (scans/photos) are
  // attached so the models read the ACTUAL documents, not just filenames.
  const media: MediaAttachment[] = [];
  for (const d of c.documents) {
    if (media.length >= 6) break;
    const isImage = d.mimeType.startsWith("image/");
    const isPdf = d.mimeType === "application/pdf" || /\.pdf$/i.test(d.fileName);
    if (!isImage && !isPdf) continue;
    try {
      const buf = await readUpload(d.filePath);
      if (buf.length > 10 * 1024 * 1024) continue;
      media.push({
        mimeType: isPdf ? "application/pdf" : d.mimeType,
        dataBase64: buf.toString("base64"),
        name: d.fileName,
      });
    } catch { /* file missing — skip */ }
  }

  async function stageRun(stageKey: string, vars: Record<string, string>, sequentialContext = false, stageMedia?: MediaAttachment[]) {
    const run = await db.analysisRun.create({ data: { caseId, stageKey, status: "running" } });
    const outcome = await runStage(stageKey, vars, { runId: run.id, sequentialContext, media: stageMedia });
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
    ? await stageRun(STAGE_KEYS.DOCUMENT, { input: docText }, false, media)
    : null;

  // Documents read by a vision model count as examined evidence.
  if (documentOut?.usedAi && media.length > 0) {
    for (const d of c.documents) {
      if (readableDocIds.has(d.id) || d.extractedJson) continue;
      const wasSent = media.some((m) => m.name === d.fileName);
      if (wasSent) {
        await db.document.update({
          where: { id: d.id },
          data: { extractedJson: JSON.stringify({ vision_reviewed: true }), status: "extracted" },
        });
      }
    }
  }

  const usedAi = summaryOut.usedAi || goalOut.usedAi || (documentOut?.usedAi ?? false);
  const docInfos = c.documents.map((d) => ({
    docKind: d.docKind,
    readable:
      readableDocIds.has(d.id) ||
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
    const oneOf = (v: unknown, allowed: string[], dflt: string) => (allowed.includes(String(v)) ? String(v) : dflt);
    // "What's still unclear" — structured list, with graceful fallback to the
    // legacy single what_we_dont_know sentence for AI outputs.
    const unclear = Array.isArray(issue.still_unclear)
      ? (issue.still_unclear as unknown[]).map(String).filter(Boolean)
      : issue.what_we_dont_know
        ? [String(issue.what_we_dont_know)]
        : [];
    await db.issue.create({
      data: {
        caseId,
        issueType: String(issue.issue_type ?? "other"),
        taxYear: typeof issue.tax_year === "number" ? issue.tax_year : null,
        title: String(issue.title ?? issue.issue_identified ?? `Issue ${i + 1}`).slice(0, 200),
        description: String(issue.what_we_know ?? ""),
        expectedCents: toCents(issue.expected_amount),
        receivedCents: toCents(issue.received_amount),
        differenceCents: toCents(issue.difference_amount),
        confidence: oneOf(issue.confidence, ["high", "medium", "low"], "medium"),
        priority: oneOf(issue.priority, ["urgent", "high", "medium", "low"], "medium"),
        state: oneOf(issue.state, ["resolved", "review", "action_needed", "urgent", "info_needed"], "review"),
        nextAction: String(issue.next_action ?? ""),
        irsBasis: String(issue.irs_basis ?? ""),
        // Evidence-based taxonomy: item kind + evidence status + strength.
        itemKind: oneOf(issue.item_kind, ["finding", "issue", "opportunity", "risk", "missing_info"], "issue"),
        evidenceStatus: oneOf(issue.evidence_status, ["confirmed", "likely", "possible", "needs_verification", "not_supported"], "needs_verification"),
        evidenceStrength: oneOf(issue.evidence_strength, ["strong", "moderate", "limited"], "limited"),
        conclusion: String(issue.our_conclusion ?? ""),
        unclearJson: JSON.stringify(unclear),
        explanationsJson: JSON.stringify(Array.isArray(issue.explanations) ? issue.explanations : []),
        altAction: String(issue.alternative_action ?? ""),
        // Per-item analysis outline (your situation → tax rules → your evidence
        // → our conclusion → your next move), rendered under each item.
        evidenceJson: JSON.stringify(Array.isArray(issue.analysis_outline) ? issue.analysis_outline : []),
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

  // Information conflicts: contradictions between the customer's narrative and
  // their documents (fallback engine) or between analysis engines (AI path).
  // Surfaced to the customer as INFORMATION CONFLICT cards — never guessed away.
  const displayConflicts = fallback
    ? fallback.conflicts
    : allConflicts.map((cf) => ({
        topic: cf.field.replace(/_/g, " "),
        description: `Our analysis sources disagree on "${cf.field.replace(/_/g, " ")}": ${cf.values.map((v) => String(v.value)).join(" vs. ")}.`,
        resolution: "Flagged for verification instead of guessing — your Account Transcript or the underlying document settles it.",
      }));

  // Consultant recommendation → notify admins.
  const needsConsultant =
    presentation?.consultant_recommended === true ||
    issues.some((i) => String(i.professional_review ?? "") === "required");
  await db.case.update({
    where: { id: caseId },
    data: {
      status: needsConsultant ? "consultant_recommended" : "analyzed",
      readinessScore: readiness,
      conflictsJson: JSON.stringify(displayConflicts),
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
    // Auto-assignment (admin-controlled; both parties still consent). A case
    // is only handed to a consultant when the analysis is grounded enough —
    // below the readiness threshold, admins are notified but no assignment is
    // proposed automatically.
    const minReadiness = await getNumberSetting("consultants.auto_assign_min_readiness", 60);
    if (readiness >= minReadiness) {
      const { autoAssignConsultant } = await import("../matching");
      await autoAssignConsultant(caseId).catch(async (err) => {
        const { logSystem } = await import("../syslog");
        await logSystem("error", "matching", "Auto-assignment failed for a flagged case", String(err));
        return false;
      });
    }
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
    return "The assistant isn't available just yet. Meanwhile, you can upload your documents to your vault and browse the guides — everything you add will be analyzed as soon as the assistant comes online.";
  }
  // Try every configured model in order; log each failure to the system log.
  for (const step of steps) {
    try {
      const prompt = fill(step.promptTemplate, { input: convo, knowledge: knowledge || "(none)" });
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) return result.text;
    } catch (err) {
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed answering the tax Q&A chat`, String(err));
    }
  }
  return "Our assistant couldn't respond just now — the issue has been reported to our team. Please try again in a moment, or open a support ticket if it keeps happening.";
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
      : "We stored your notice safely. Our reference library doesn't cover this notice type yet — a professional review can explain it, and it will be re-examined automatically on your next analysis.",
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
  // Try every configured model; log failures; fall back to the template letter.
  for (const step of steps) {
    try {
      const prompt = fill(step.promptTemplate, { input: context });
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) return result.text;
    } catch (err) {
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed generating a response letter draft`, String(err));
    }
  }
  {
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
}
