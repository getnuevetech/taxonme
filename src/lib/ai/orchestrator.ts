import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type ChatMessage, type MediaAttachment } from "./adapters";
import { mergeStructured, computeReadiness, type Conflict } from "./consensus";
import { fallbackAnalyze } from "./fallback";
import { STAGE_KEYS } from "../constants";
import { getNumberSetting } from "../settings";
import { readUpload } from "../uploads";
import { verifyCaseProgress } from "../case-progress";
import { buildCanonicalCaseState, upsertCanonicalCaseState } from "../canonical-case-state";
import { recordCaseDiscovery } from "../case-discovery";
import { composePromptForStep } from "./prompt-composer";
import {
  completeCaseAnalysisVersion,
  finishReanalysisEvent,
  queueHumanReview,
  recordDocumentFieldVerifications,
  recordPresentationSnapshot,
  recordReanalysisEvent,
  startCaseAnalysisVersion,
  upsertSourceSnapshot,
} from "./audit";
import { providerAllowedForTaxData } from "./provider-policy";
import { extractUserFacingText, validateAiJson } from "./validation";

type Json = Record<string, unknown>;

function hasUnfiledReturnIntent(text: string): boolean {
  return /(didn'?t file|haven'?t filed|have not file[dn]?|has not file[dn]?|not filed|unfiled|late filing|missed filing|never filed|file taxes for (the )?past|years behind|behind on (my )?taxes|out of compliance)/i.test(text);
}

function hasRefundIntent(text: string): boolean {
  return /\b(refund|overpayment|offset|deposit|line 35a)\b/i.test(text);
}

function normalizePresentation(data: Json | null): Json | null {
  if (!data) return null;
  if (Array.isArray(data.issues)) return data;
  const card = typeof data.finding_card === "object" && data.finding_card !== null
    ? data.finding_card as Json
    : null;
  if (!card) return null;
  const nextStep = typeof data.next_step === "object" && data.next_step !== null
    ? data.next_step as Json
    : {};
  const professionalHelp = typeof data.professional_help === "object" && data.professional_help !== null
    ? data.professional_help as Json
    : {};
  const how = typeof data.how_we_reached_this === "object" && data.how_we_reached_this !== null
    ? data.how_we_reached_this as Record<string, unknown>
    : {};
  const outline = [
    ["Your situation", how.your_situation],
    ["Tax rules", how.tax_rules],
    ["Your evidence", how.your_evidence],
    ["Our conclusion", how.our_conclusion],
  ].map(([heading, value]) => ({ heading, detail: Array.isArray(value) ? value.map(String).join(" ") : String(value ?? "") }));
  return {
    headline: String(card.headline ?? ""),
    issues: [
      {
        issue_type: String(card.category ?? "other"),
        item_kind: "issue",
        evidence_status: String(card.status ?? "needs_verification").toLowerCase(),
        evidence_strength: String(data.evidence_strength ?? "LIMITED").toLowerCase(),
        title: String(card.headline ?? "Tax finding"),
        what_we_know: Array.isArray(data.what_we_found) ? data.what_we_found.map(String).join(" ") : String(card.summary ?? ""),
        our_conclusion: outline.find((x) => x.heading === "Our conclusion")?.detail ?? "",
        still_unclear: Array.isArray(data.what_is_still_unclear) ? data.what_is_still_unclear.map(String) : [],
        priority: String(card.priority ?? "MEDIUM").toLowerCase(),
        state: String(card.status ?? "").toUpperCase() === "NEEDS_VERIFICATION" ? "info_needed" : "review",
        next_action: String(nextStep.action_label ?? nextStep.title ?? ""),
        alternative_action: Array.isArray(data.alternative_actions) ? data.alternative_actions.map(String).join("; ") : "",
        analysis_outline: outline,
      },
    ],
    path_steps: [
      {
        title: String(nextStep.title ?? "Review the finding"),
        description: String(nextStep.description ?? ""),
        action_key: String(nextStep.action_label ?? "review_analysis").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      },
    ],
    consultant_recommended: professionalHelp.recommended === true,
    consultant_reason: String(professionalHelp.message ?? ""),
  };
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
  return stage.steps.filter((s) => providerAllowedForTaxData(s.provider));
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

function outputRequestsGate(data: Json | null): boolean {
  if (!data) return false;
  const serialized = JSON.stringify(data).toLowerCase();
  return (
    serialized.includes("verification_required") ||
    serialized.includes("needs_verification") ||
    serialized.includes("human_review") ||
    serialized.includes("reanalyze") ||
    serialized.includes("conflicting") ||
    serialized.includes('"status":"disagree"') ||
    serialized.includes('"status":"not_supported"') ||
    serialized.includes('"source_missing"')
  );
}

function humanReviewReasons(input: {
  narrative: string;
  issues: Json[];
  conflicts: Conflict[];
  needsConsultant: boolean;
}): { reason: string; severity: string }[] {
  const reasons: { reason: string; severity: string }[] = [];
  if (/(criminal|fraud|summons|tax court|levy|lien|seizure|bankruptcy|international|trust fund|payroll tax)/i.test(input.narrative)) {
    reasons.push({ reason: "Configured high-risk tax category detected", severity: "urgent" });
  }
  if (input.conflicts.length > 0 || input.issues.some((i) => String(i.evidence_status ?? i.status ?? "").toLowerCase().includes("verification"))) {
    reasons.push({ reason: "Material facts or model outputs require verification", severity: "high" });
  }
  if (input.needsConsultant) {
    reasons.push({ reason: "Professional review recommended or required by analysis", severity: "high" });
  }
  return reasons;
}

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
  const steps = stage?.isEnabled
    ? stage.steps.filter((s) => providerAllowedForTaxData(s.provider))
    : [];
  const stepOutputs: StageOutcome["stepOutputs"] = [];
  let prior = "";
  let qualityFailure = false;

  async function runOneStep(step: (typeof steps)[number], stepPrior: string): Promise<boolean> {
    const shouldRunConditional =
      stage?.reviewerRequired ||
      qualityFailure ||
      stepOutputs.length === 0 ||
      stepOutputs.some((o) => outputRequestsGate(o.data));
    if (step.isConditional && !shouldRunConditional) return false;
    const composed = await composePromptForStep(step, { ...vars, prior: stepPrior });
    const messages: ChatMessage[] = [{ role: "user", content: composed.text }];
    const started = Date.now();
    try {
      const result = await callProvider(step.provider, messages, opts?.media ?? []);
      const data = extractJson(result.text);
      const validation = validateAiJson(stageKey, data);
      if (!validation.ok && data) {
        qualityFailure = true;
        throw new Error(`Invalid ${stageKey} JSON from ${step.role}: ${validation.error}`);
      }
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
            promptId: composed.promptId,
            promptVersion: composed.promptVersion,
            schemaVersion: composed.schemaVersion,
            providerRoute: step.routeKey,
            modelRoute: step.provider.model,
            qualityGate: validation.qualityGate,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            estimatedCostMicros: result.estimatedCostMicros,
          },
        });
      }
      return true;
    } catch (err) {
      qualityFailure = true;
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
            promptId: step.promptId,
            promptVersion: step.promptVersion,
            schemaVersion: step.schemaVersion,
            providerRoute: step.routeKey,
            modelRoute: step.provider.model,
            qualityGate: "FAIL",
            errorCode: /invalid|schema/i.test(String(err)) ? "invalid_schema" : "provider_error",
          },
        });
      }
      return false;
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.mode === "parallel") {
      const group = [step];
      while (steps[i + 1]?.mode === "parallel") {
        group.push(steps[i + 1]);
        i++;
      }
      await Promise.all(group.map((parallelStep) => runOneStep(parallelStep, "")));
      continue;
    }
    if (step.mode === "failover") {
      const group = [step];
      while (steps[i + 1]?.mode === "failover") {
        group.push(steps[i + 1]);
        i++;
      }
      for (const candidate of group) {
        if (await runOneStep(candidate, prior)) break;
      }
      continue;
    }
    await runOneStep(step, prior);
  }

  const structured = stepOutputs.filter((o) => o.data);
  const { merged, conflicts } = stage?.mergeStrategy === "consensus"
    ? mergeStructured(structured.map((o) => ({ source: o.source, data: o.data as Json })))
    : { merged: (structured.at(-1)?.data as Json | undefined) ?? {}, conflicts: [] };
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

export async function runCaseAnalysis(caseId: string, opts?: { trigger?: string; reanalysisEventId?: string }): Promise<void> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { documents: { where: { deletedAt: null } } },
  });
  if (!c) return;
  const trigger = opts?.trigger ?? "case_analysis";
  const reanalysisEventId = opts?.reanalysisEventId ?? await recordReanalysisEvent(caseId, trigger, [
    STAGE_KEYS.SUMMARY,
    STAGE_KEYS.GOAL,
    STAGE_KEYS.DOCUMENT,
    STAGE_KEYS.SITUATION,
    STAGE_KEYS.PRESENTER,
  ]);
  const analysisVersion = await startCaseAnalysisVersion(caseId, trigger);
  const caseAnalysisVersion = analysisVersion.version;
  const sourceSnapshotIds: string[] = [];
  const caseEvidenceIds = c.documents.map((d) => d.id).join(",");
  await recordCaseDiscovery(caseId, caseAnalysisVersion);
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
    const stage = await db.pipelineStage.findUnique({ where: { key: stageKey } });
    const sourceId = await upsertSourceSnapshot(vars.irs_sources || vars.knowledge || "");
    if (sourceId) sourceSnapshotIds.push(sourceId);
    const canonicalState = await buildCanonicalCaseState(caseId);
    const promptVars = {
      ...vars,
      current_canonical_case_state: canonicalState ? JSON.stringify(canonicalState) : JSON.stringify({ case_id: caseId, case_version: caseAnalysisVersion }),
      case_version: String(canonicalState?.case_version ?? caseAnalysisVersion),
      evidence_ids: caseEvidenceIds,
      source_ids: sourceId,
    };
    const run = await db.analysisRun.create({
      data: {
        caseId,
        stageKey,
        status: "running",
        caseAnalysisVersion,
        pipelineVersion: stage?.version ?? "",
        schemaVersion: "3.0",
        sourceSnapshotId: sourceId,
        metadataJson: JSON.stringify({ stageKey, caseAnalysisVersion, pipelineVersion: stage?.version ?? "", sourceSnapshotId: sourceId, inputKeys: Object.keys(promptVars) }),
      },
    });
    const outcome = await runStage(stageKey, promptVars, { runId: run.id, sequentialContext, media: stageMedia });
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
  const summaryOut = await stageRun(STAGE_KEYS.SUMMARY, { input: c.situation, goal: c.goal }, true);
  const goalOut = await stageRun(STAGE_KEYS.GOAL, {
    input: c.goal,
    goal: c.goal,
    summary_analysis: JSON.stringify(summaryOut.merged),
    verified_case_facts: JSON.stringify(summaryOut.merged),
  }, true);
  const documentOut = c.documents.length
    ? await stageRun(STAGE_KEYS.DOCUMENT, {
        input: docText,
        documents: docText,
        document_id: c.documents.map((d) => d.id).join(","),
        existing_verified_documents: "(none)",
      }, false, media)
    : null;
  if (documentOut) {
    await recordDocumentFieldVerifications({
      documents: c.documents.map((d) => ({ id: d.id, caseId: d.caseId })),
      analysisVersionId: analysisVersion.id,
      stepOutputs: documentOut.stepOutputs,
    });
  }

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
      document_findings: documentOut ? JSON.stringify(documentOut.merged) : "(no documents uploaded)",
      knowledge: knowledge || "(no matching reference material)",
      irs_sources: knowledge || "(no matching reference material)",
      goal: JSON.stringify(goalFacts),
      system_calculations: "(none supplied)",
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
    if (p) {
      await recordPresentationSnapshot({
        caseId,
        analysisVersionId: analysisVersion.id,
        schemaVersion: "3.0",
        presentation: p,
      });
    }
    presentation = normalizePresentation(p);
  }
  let issues: Json[] = presentation
    ? ((presentation.issues as Json[]) ?? [])
    : (fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos))).issues;
  const narrativeText = `${c.situation}\n${c.goal}`;
  if (hasUnfiledReturnIntent(narrativeText) && !hasRefundIntent(narrativeText)) {
    issues = issues.filter((issue) => String(issue.issue_type ?? "") !== "refund_discrepancy");
    if (!issues.some((issue) => String(issue.issue_type ?? "") === "missing_return")) {
      const deterministic = fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos));
      const missingReturn = deterministic.issues.find((issue) => String(issue.issue_type ?? "") === "missing_return");
      if (missingReturn) issues.unshift(missingReturn);
    }
  }

  // Persist issues.
  const issueIds: string[] = [];
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
    const createdIssue = await db.issue.create({
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
    issueIds.push(createdIssue.id);
  }

  // Path forward steps (each carries an action key for evidence verification).
  const pathSteps: Json[] = presentation?.path_steps
    ? ((presentation.path_steps as Json[]) ?? [])
    : ((fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos))).pathSteps as unknown as Json[]);
  const pathStepIds: string[] = [];
  for (const [i, step] of pathSteps.entries()) {
    const createdStep = await db.pathStep.create({
      data: {
        caseId,
        sortOrder: i,
        title: String(step.title ?? `Step ${i + 1}`).slice(0, 200),
        description: String(step.description ?? ""),
        actionKey: String(step.action_key ?? ""),
        status: i === 0 ? "current" : "pending",
      },
    });
    pathStepIds.push(createdStep.id);
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

  const reviewReasons = humanReviewReasons({
    narrative: `${c.situation}\n${c.goal}`,
    issues,
    conflicts: allConflicts,
    needsConsultant,
  });
  for (const review of reviewReasons) {
    await queueHumanReview({
      caseId,
      analysisVersionId: analysisVersion.id,
      reason: review.reason,
      severity: review.severity,
      payload: { readiness, conflicts: displayConflicts.slice(0, 5) },
    });
  }

  await completeCaseAnalysisVersion({
    analysisVersionId: analysisVersion.id,
    status: reviewReasons.length > 0 ? "human_review" : allConflicts.length > 0 ? "needs_verification" : "approved",
    issueIds,
    pathStepIds,
    sourceSnapshotIds,
    snapshot: {
      case_id: caseId,
      status: needsConsultant ? "consultant_recommended" : "analyzed",
      readiness,
      facts,
      goal: goalFacts,
      documents: documentOut?.merged ?? null,
      analysis: situationMerged,
      presentation,
      conflicts: displayConflicts,
      human_review: reviewReasons,
    },
  });
  await upsertCanonicalCaseState(caseId, "case_analysis");
  await finishReanalysisEvent(reanalysisEventId, "complete");

  // Immediately verify path-step evidence (e.g. documents already uploaded at intake).
  await verifyCaseProgress(caseId);
}

// ---------- Single-purpose AI helpers ----------

function dollars(cents: number | null): string {
  return typeof cents === "number" ? `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "";
}

async function buildQaUserContext(userId?: string): Promise<string> {
  if (!userId) return "";
  const cases = await db.case.findMany({
    where: { userId, status: { not: "closed" } },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      documents: { where: { deletedAt: null }, select: { docKind: true, fileName: true } },
      pathSteps: { where: { status: "current" }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
  if (cases.length === 0) return "User has no open cases yet.";
  const lines: string[] = [];
  for (const c of cases) {
    lines.push(`Case: ${c.title} (status: ${c.status}, readiness: ${c.readinessScore}%).`);
    if (c.goal) lines.push(`Goal: ${c.goal.slice(0, 300)}`);
    for (const issue of c.issues.slice(0, 4)) {
      const amounts = [
        issue.expectedCents !== null ? `expected ${dollars(issue.expectedCents)}` : "",
        issue.receivedCents !== null ? `received ${dollars(issue.receivedCents)}` : "",
        issue.differenceCents !== null ? `difference ${dollars(issue.differenceCents)}` : "",
      ].filter(Boolean).join(", ");
      lines.push(`Open finding: ${issue.title}${issue.taxYear ? ` (${issue.taxYear})` : ""}${amounts ? ` — ${amounts}` : ""}.`);
      try {
        const unclear = JSON.parse(issue.unclearJson || "[]");
        if (Array.isArray(unclear) && unclear.length) lines.push(`Still unclear: ${unclear.map(String).slice(0, 3).join("; ")}`);
      } catch { /* ignore malformed legacy data */ }
    }
    const current = c.pathSteps[0];
    if (current) lines.push(`Current step: ${current.title}${current.description ? ` — ${current.description}` : ""}`);
    if (c.documents.length) lines.push(`Documents on file: ${c.documents.map((d) => `${d.docKind}:${d.fileName}`).slice(0, 5).join(", ")}`);
  }
  return lines.join("\n");
}

export async function runQaChat(history: { role: string; content: string }[], userId?: string): Promise<string> {
  const steps = await getRunnableSteps(STAGE_KEYS.QA);
  const convo = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const userContext = await buildQaUserContext(userId);
  const knowledge = await retrieveKnowledge(`${userContext}\n${history.map((m) => m.content).join(" ")}`);
  if (steps.length === 0) {
    return "The assistant isn't available just yet. Meanwhile, you can upload your documents to your vault and browse the guides — everything you add will be analyzed as soon as the assistant comes online.";
  }
  try {
    const outcome = await runStage(STAGE_KEYS.QA, {
      input: convo,
      question: history.filter((m) => m.role === "user").at(-1)?.content ?? "",
      knowledge: knowledge || "(none)",
      irs_sources: knowledge || "(none)",
      user_context: userContext || "(none)",
      tax_year_or_context: "unknown unless stated by the user",
      claims: convo,
      verified_answer: "(use prior source verification output when present)",
    }, { sequentialContext: true });
    const final = outcome.stepOutputs.at(-1);
    if (final) return extractUserFacingText(final.data, final.rawText);
  } catch (err) {
    const { logSystem } = await import("../syslog");
    await logSystem("error", "ai_call", "AI tax Q&A pipeline failed", String(err));
  }
  return "Our assistant couldn't respond just now — the issue has been reported to our team. Please try again in a moment, or open a support ticket if it keeps happening.";
}

export async function explainNoticeContent(content: string): Promise<Json | null> {
  const knowledge = await retrieveKnowledge(content);
  const outcome = await runStage(STAGE_KEYS.NOTICE, {
    input: content,
    notice_document: content,
    case_context: "(no linked case context supplied)",
    irs_sources: knowledge || "(no matching notice-specific reference material)",
    claims: content,
    review: "(use prior reviewer output when present)",
  }, { sequentialContext: true });
  const parsed = outcome.stepOutputs.at(-1)?.data ?? outcome.stepOutputs.find((o) => o.data)?.data ?? null;
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
      const composed = await composePromptForStep(step, {
        input: context,
        facts: context,
        notice: context,
        position: context,
        supporting_documents: "(use only documents described in the approved context)",
        irs_sources: "(none supplied)",
        draft: "",
        required_changes: "",
      });
      const prompt = composed.text;
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
