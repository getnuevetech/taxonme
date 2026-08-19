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

function parseJsonRecord(value: string): Json {
  try {
    const parsed = JSON.parse(value || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Json : {};
  } catch {
    return {};
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
      discoveries: { orderBy: { createdAt: "desc" }, take: 1 },
      issueClusters: { orderBy: { sortOrder: "asc" } },
      actionNodes: { orderBy: { priority: "asc" } },
      evidenceFacts: { orderBy: { createdAt: "asc" } },
      events: { orderBy: [{ taxPeriod: "asc" }, { eventDate: "asc" }] },
      accountStates: { orderBy: { taxPeriod: "asc" } },
      evidenceRelationships: true,
      unknowns: true,
      suppressedQuestions: true,
      evidenceAudits: { orderBy: { createdAt: "desc" }, take: 1 },
      reconstruction: true,
    },
  });
  if (!c) return null;
  const latestVersion = c.analysisVersions[0]?.version ?? 1;
  const latestDiscovery = c.discoveries[0]?.discoveryJson
    ? (() => {
        try {
          return JSON.parse(c.discoveries[0].discoveryJson) as Json;
        } catch {
          return null;
        }
      })()
    : null;
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
  const latestAudit = c.evidenceAudits[0] ?? null;
  const evidenceLedger = c.evidenceFacts.map((fact) => ({
    fact_id: fact.id,
    fact_key: fact.factKey,
    fact_type: fact.factType,
    value: fact.valueNumber ?? fact.valueText,
    unit: fact.unit || null,
    tax_period: fact.taxPeriod || null,
    effective_date: fact.effectiveDate,
    provenance: fact.provenance,
    source_id: fact.sourceId || null,
    source_field: fact.sourceField || null,
  }));
  return {
    case_id: c.id,
    case_version: latestVersion,
    evidence_state: {
      documents_total: c.documents.length,
      documents_processed: c.documents.filter((d) => d.processingStatus === "complete").length,
      documents_verified: c.documents.filter((d) => d.verificationStatus === "verified").length,
      duplicates_resolved: c.documents.filter((d) => d.duplicateOfId).length,
      processing_complete: c.documents.every((d) => d.processingStatus === "complete"),
      processing_failures: c.documents
        .filter((d) => d.processingStatus === "failed" || d.processingStatus === "partial")
        .map((d) => ({ document_id: d.id, name: d.fileName, status: d.processingStatus, notes: parseJsonArray(d.processingNotesJson) })),
      audit_status: latestAudit?.status ?? null,
    },
    evidence_ledger: evidenceLedger,
    event_ledger: c.events.map((event) => ({
      event_id: event.id,
      tax_period: event.taxPeriod || null,
      event_type: event.eventType,
      transaction_code: event.transactionCode || null,
      description: event.description,
      date: event.eventDate,
      amount: event.amount,
      balance_effect: event.balanceEffect || null,
    })),
    account_states: c.accountStates.map((state) => ({
      tax_period: state.taxPeriod,
      current_balance: state.currentBalance,
      current_balance_as_of: state.currentBalanceAsOf,
      current_status: state.currentStatus,
      detail: parseJsonRecord(state.stateJson),
      supporting_facts: parseJsonArray(state.supportingFactIdsJson),
    })),
    cross_document_relationships: c.evidenceRelationships.map((rel) => ({
      relationship_type: rel.relationshipType,
      from_tax_period: rel.fromTaxPeriod || null,
      to_tax_period: rel.toTaxPeriod || null,
      amount: rel.amount,
      status: rel.status,
      description: rel.description,
      supporting_facts: parseJsonArray(rel.supportingFactIdsJson),
    })),
    case_reconstruction: c.reconstruction ? parseJsonRecord(c.reconstruction.reconstructionJson) : {},
    resolved_unknowns: [
      ...c.unknowns.filter((u) => u.status !== "ACTIVE").map((u) => ({
        unknown_id: u.id,
        original_question: u.question || u.label,
        resolution_status: u.status,
        resolved_value: u.resolvedValue || null,
        supporting_fact_ids: parseJsonArray(u.supportingFactIdsJson),
      })),
      ...c.suppressedQuestions.map((q) => ({
        unknown_id: q.id,
        original_question: q.question,
        resolution_status: "RESOLVED_BY_EXISTING_EVIDENCE",
        resolved_value: null,
        supporting_fact_ids: parseJsonArray(q.supportingFactIdsJson),
      })),
    ],
    active_unknowns: c.unknowns.filter((u) => u.status === "ACTIVE").map((u) => ({
      unknown_id: u.id,
      label: u.label,
      question: u.question,
      reason: u.reason,
      materiality: u.materiality,
    })),
    evidence_audit: latestAudit ? parseJsonRecord(latestAudit.reportJson) : {},
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
    issues: c.issueClusters.length > 0 ? c.issueClusters.map((cluster) => ({
      issue_id: cluster.id,
      title: cluster.title,
      category: cluster.category,
      status: cluster.status,
      evidence_strength: cluster.evidenceStrength,
      sub_findings: parseJsonArray(cluster.issueIdsJson),
      unknowns: parseJsonArray(cluster.unknownsJson),
      possible_explanations: parseJsonArray(cluster.possibleExplanationsJson),
      actions: parseJsonArray(cluster.actionsJson),
    })) : c.issues.map((issue) => ({
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
    actions: c.actionNodes.length > 0 ? c.actionNodes.map((action) => ({
      action_id: action.id,
      type: action.actionKey,
      normalized_purpose: action.normalizedPurpose,
      title: action.title,
      description: action.description,
      priority: action.priority,
      depends_on: parseJsonArray(action.dependsOnJson),
      resolves: parseJsonArray(action.resolvesJson),
      requires: parseJsonArray(action.requiresJson),
      status: action.status,
    })) : actions,
    professional_review: {
      recommended: c.status === "consultant_recommended",
      status: c.status,
    },
    analysis_status: {
      case_status: c.status,
      readiness_score: c.readinessScore,
      evidence_available_score: c.evidenceAvailableScore,
      evidence_processed_score: c.evidenceProcessedScore,
      latest_analysis_version: latestVersion,
      latest_presentation_id: c.presentations[0]?.id ?? null,
    },
    discovery: latestDiscovery,
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
