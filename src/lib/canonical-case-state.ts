import crypto from "crypto";
import { db } from "./db";

type Json = Record<string, unknown>;

function hashState(state: Json): string {
  return crypto.createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function provenanceForEvidenceStatus(status: string): string {
  if (status === "confirmed") return "DOCUMENT_VERIFIED";
  if (status === "likely") return "DOCUMENT_EXTRACTED";
  if (status === "possible") return "MODEL_INFERENCE";
  return "MODEL_INFERENCE";
}

export async function buildCanonicalCaseState(caseId: string): Promise<Json | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null }, include: { fieldVerifications: true } },
      notices: true,
      deadlines: true,
      clarifyMessages: { orderBy: { createdAt: "asc" } },
      analysisVersions: { orderBy: { version: "desc" }, take: 1 },
      presentations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) return null;
  const latestVersion = c.analysisVersions[0]?.version ?? 1;
  const documentFacts = c.documents.flatMap((doc) =>
    doc.fieldVerifications.map((field) => ({
      fact: field.fieldKey,
      value: field.fieldValue,
      document_id: doc.id,
      document_name: doc.fileName,
      status: field.status,
      provenance: field.status === "verified" ? "DOCUMENT_VERIFIED" : "DOCUMENT_EXTRACTED",
      source_id: field.id,
    })),
  );
  const issueFacts = c.issues.map((issue) => ({
    fact: issue.title,
    value: issue.conclusion || issue.description,
    tax_year: issue.taxYear,
    provenance: provenanceForEvidenceStatus(issue.evidenceStatus),
    source_id: issue.id,
    certainty: issue.evidenceStatus.toUpperCase(),
  }));
  const actions = c.pathSteps
    .filter((step) => step.title && step.description)
    .map((step, index) => ({
      action_id: step.id,
      type: step.actionKey || "UNCLASSIFIED_ACTION",
      title: step.title,
      description: step.description,
      priority: index + 1,
      depends_on: index > 0 ? [c.pathSteps[index - 1]?.id].filter(Boolean) : [],
      resolves: [],
      requires: [],
      status: step.status === "done" ? "DONE" : step.status === "current" ? "READY" : "PENDING",
    }));
  const sourceConflicts = parseJsonArray(c.conflictsJson).filter((x) => typeof x === "object");
  return {
    case_id: c.id,
    case_version: latestVersion,
    user_input: {
      original_summary: c.situation,
      original_goal: c.goal,
    },
    subjects: [],
    tax_periods: Array.from(new Set(c.issues.map((i) => i.taxYear).filter(Boolean))),
    entities: [],
    reported_facts: c.clarifyMessages
      .filter((m) => m.role === "user")
      .map((m) => ({ fact: m.content, provenance: "USER_REPORTED", source_id: m.id })),
    verified_facts: [...documentFacts.filter((f) => f.provenance === "DOCUMENT_VERIFIED"), ...issueFacts.filter((f) => f.provenance !== "MODEL_INFERENCE")],
    document_facts: documentFacts,
    authority_facts: c.issues.filter((i) => i.irsBasis).map((i) => ({ fact: i.irsBasis, provenance: "IRS_AUTHORITY", source_id: i.id })),
    inferences: issueFacts.filter((f) => f.provenance === "MODEL_INFERENCE"),
    issues: c.issues.map((issue) => ({
      issue_id: issue.id,
      title: issue.title,
      category: issue.issueType || "UNCLASSIFIED_TAX_ISSUE",
      status: issue.evidenceStatus.toUpperCase(),
      evidence_strength: issue.evidenceStrength.toUpperCase(),
      sub_findings: parseJsonArray(issue.evidenceJson),
      unknowns: parseJsonArray(issue.unclearJson),
      possible_explanations: parseJsonArray(issue.explanationsJson),
      actions: actions.filter((a) => String(a.resolves).includes(issue.id)),
    })),
    goals: c.goal ? [{ raw_value: c.goal, provenance: "USER_REPORTED", source_id: "case.goal" }] : [],
    unknowns: c.issues.flatMap((issue) => parseJsonArray(issue.unclearJson)),
    source_conflicts: sourceConflicts,
    model_disagreements: c.analysisVersions[0]?.status === "needs_verification" ? sourceConflicts : [],
    relationships: [],
    deadlines: c.deadlines.map((d) => ({ id: d.id, title: d.title, due_date: d.dueDate, status: d.status })),
    amounts: c.issues.flatMap((issue) => [
      issue.expectedCents !== null ? { label: "expected", cents: issue.expectedCents, issue_id: issue.id } : null,
      issue.receivedCents !== null ? { label: "received", cents: issue.receivedCents, issue_id: issue.id } : null,
      issue.differenceCents !== null ? { label: "difference", cents: issue.differenceCents, issue_id: issue.id } : null,
    ].filter(Boolean)),
    documents: c.documents.map((doc) => ({
      document_id: doc.id,
      name: doc.fileName,
      kind: doc.docKind,
      status: doc.status,
      uploaded_at: doc.uploadedAt,
    })),
    resolution_options: [],
    approved_findings: c.issues.filter((i) => ["confirmed", "likely"].includes(i.evidenceStatus)).map((i) => i.id),
    actions,
    professional_review: {
      recommended: c.status === "consultant_recommended",
      status: c.status,
    },
    analysis_status: {
      case_status: c.status,
      readiness_score: c.readinessScore,
      latest_analysis_version: latestVersion,
      latest_presentation_id: c.presentations[0]?.id ?? null,
    },
  };
}

export async function upsertCanonicalCaseState(caseId: string, trigger = "analysis"): Promise<{ version: number; changed: boolean } | null> {
  const state = await buildCanonicalCaseState(caseId);
  if (!state) return null;
  const stateHash = hashState(state);
  const existing = await db.canonicalCaseState.findUnique({ where: { caseId } });
  if (existing?.stateHash === stateHash) return { version: existing.version, changed: false };
  const version = existing ? existing.version + 1 : Number(state.case_version ?? 1);
  state.case_version = version;
  const finalHash = hashState(state);
  await db.canonicalCaseState.upsert({
    where: { caseId },
    update: { version, stateJson: JSON.stringify(state), stateHash: finalHash, status: "current" },
    create: { caseId, version, stateJson: JSON.stringify(state), stateHash: finalHash, status: "current" },
  });
  await db.canonicalCaseStateSnapshot.create({
    data: { caseId, version, trigger, stateJson: JSON.stringify(state), stateHash: finalHash },
  });
  return { version, changed: true };
}
