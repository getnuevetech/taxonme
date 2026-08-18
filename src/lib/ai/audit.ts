import "server-only";
import crypto from "crypto";
import { db } from "../db";
import { sourceSnapshotId } from "./privacy";

type Json = Record<string, unknown>;

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function startCaseAnalysisVersion(caseId: string, trigger: string): Promise<{ id: string; version: number }> {
  const [count, existing] = await Promise.all([
    db.caseAnalysisVersion.count({ where: { caseId } }),
    db.case.findUnique({
      where: { id: caseId },
      include: { issues: true, pathSteps: true },
    }),
  ]);
  const version = count + 1;
  const row = await db.caseAnalysisVersion.create({
    data: {
      caseId,
      version,
      trigger,
      status: "running",
      snapshotJson: JSON.stringify({
        previous_status: existing?.status ?? null,
        previous_readiness: existing?.readinessScore ?? null,
        previous_issues: existing?.issues ?? [],
        previous_path_steps: existing?.pathSteps ?? [],
      }),
    },
  });
  return { id: row.id, version: row.version };
}

export async function completeCaseAnalysisVersion(args: {
  analysisVersionId: string;
  status: string;
  issueIds: string[];
  pathStepIds: string[];
  sourceSnapshotIds: string[];
  snapshot: Json;
}): Promise<void> {
  await db.caseAnalysisVersion.update({
    where: { id: args.analysisVersionId },
    data: {
      status: args.status,
      issueIdsJson: JSON.stringify(args.issueIds),
      pathStepIdsJson: JSON.stringify(args.pathStepIds),
      sourceSnapshotIdsJson: JSON.stringify(Array.from(new Set(args.sourceSnapshotIds.filter(Boolean)))),
      snapshotJson: JSON.stringify(args.snapshot),
      approvedAt: args.status === "approved" ? new Date() : null,
    },
  });
}

export async function recordReanalysisEvent(caseId: string, trigger: string, pipelines: string[], metadata: Json = {}): Promise<string> {
  const event = await db.caseReanalysisEvent.create({
    data: {
      caseId,
      trigger,
      pipelinesJson: JSON.stringify(pipelines),
      status: "running",
      metadataJson: JSON.stringify(metadata),
    },
  });
  return event.id;
}

export async function finishReanalysisEvent(eventId: string, status: "complete" | "failed"): Promise<void> {
  await db.caseReanalysisEvent.update({
    where: { id: eventId },
    data: { status, finishedAt: new Date() },
  }).catch(() => null);
}

function sourceRefs(sourceContext: string): string[] {
  return Array.from(
    new Set(
      sourceContext
        .split("\n")
        .map((line) => (line.match(/^\[([^\]]+)\]/)?.[1] ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export async function upsertSourceSnapshot(sourceContext: string): Promise<string> {
  const shortId = sourceSnapshotId(sourceContext);
  if (!shortId) return "";
  const snapshotHash = hashText(sourceContext);
  const taxYears = Array.from(new Set(sourceContext.match(/\b20\d{2}\b/g) ?? []));
  const snapshot = await db.sourceSnapshot.upsert({
    where: { snapshotHash },
    update: {},
    create: {
      snapshotHash,
      sourceRefsJson: JSON.stringify(sourceRefs(sourceContext)),
      taxYearsJson: JSON.stringify(taxYears),
      metadataJson: JSON.stringify({ short_id: shortId, source_count: sourceRefs(sourceContext).length }),
    },
  });
  return snapshot.id;
}

export async function recordPresentationSnapshot(args: {
  caseId: string;
  analysisVersionId: string;
  schemaVersion: string;
  presentation: Json;
}): Promise<void> {
  await db.casePresentation.create({
    data: {
      caseId: args.caseId,
      analysisVersionId: args.analysisVersionId,
      schemaVersion: args.schemaVersion,
      presentationJson: JSON.stringify(args.presentation),
    },
  });
}

export async function queueHumanReview(args: {
  caseId: string;
  analysisVersionId?: string;
  reason: string;
  severity?: string;
  payload?: Json;
}): Promise<void> {
  const existing = await db.humanReviewItem.findFirst({
    where: {
      caseId: args.caseId,
      reason: args.reason,
      status: { in: ["open", "assigned"] },
    },
  });
  if (existing) return;
  await db.humanReviewItem.create({
    data: {
      caseId: args.caseId,
      analysisVersionId: args.analysisVersionId ?? null,
      reason: args.reason,
      severity: args.severity ?? "medium",
      payloadJson: JSON.stringify(args.payload ?? {}),
    },
  });
}

function primitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function criticalFields(data: Json | null): Record<string, string> {
  if (!data) return {};
  const docId = typeof data.document_identification === "object" && data.document_identification !== null
    ? data.document_identification as Json
    : {};
  const out: Record<string, string> = {};
  for (const key of ["document_type", "form_number", "notice_type", "tax_year", "tax_period_end", "filing_status"]) {
    const value = data[key] ?? docId[key];
    if (value !== undefined && value !== null && value !== "") out[key] = primitive(value);
  }
  const amounts = Array.isArray(data.amounts) ? data.amounts : Array.isArray(data.financial_entries) ? data.financial_entries : [];
  for (const item of amounts.slice(0, 12)) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Json;
    const label = primitive(row.label ?? row.description ?? "amount").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    const value = row.value ?? row.amount;
    if (value !== undefined && value !== null && value !== "") out[`amount:${label}`] = primitive(value);
  }
  return out;
}

export async function recordDocumentFieldVerifications(args: {
  documents: { id: string; caseId: string | null }[];
  analysisVersionId: string;
  stepOutputs: { role: string; data: Json | null; source: string }[];
}): Promise<void> {
  const a = args.stepOutputs.find((o) => o.role === "extractor_a")?.data ?? null;
  const b = args.stepOutputs.find((o) => o.role === "extractor_b")?.data ?? null;
  const aFields = criticalFields(a);
  const bFields = criticalFields(b);
  const keys = Array.from(new Set([...Object.keys(aFields), ...Object.keys(bFields)]));
  if (keys.length === 0) return;
  for (const doc of args.documents) {
    await db.documentFieldVerification.deleteMany({
      where: { documentId: doc.id, analysisVersionId: args.analysisVersionId },
    });
    for (const key of keys) {
      const left = aFields[key] ?? "";
      const right = bFields[key] ?? "";
      const status = left && right && left === right ? "verified" : "verification_required";
      await db.documentFieldVerification.create({
        data: {
          documentId: doc.id,
          caseId: doc.caseId,
          analysisVersionId: args.analysisVersionId,
          fieldKey: key,
          fieldValue: left || right,
          status,
          sourcesJson: JSON.stringify([
            left ? { source: "extractor_a", value: left } : null,
            right ? { source: "extractor_b", value: right } : null,
          ].filter(Boolean)),
        },
      });
    }
    const hasVerificationIssue = keys.some((key) => {
      const left = aFields[key] ?? "";
      const right = bFields[key] ?? "";
      return !left || !right || left !== right;
    });
    await db.document.update({
      where: { id: doc.id },
      data: {
        status: hasVerificationIssue ? "verification_required" : "extracted",
        verificationStatus: hasVerificationIssue ? "verification_required" : "verified",
        extractionSchemaVersion: "3.1",
        extractorVersionsJson: JSON.stringify({
          extractor_a: args.stepOutputs.find((o) => o.role === "extractor_a")?.source ?? "",
          extractor_b: args.stepOutputs.find((o) => o.role === "extractor_b")?.source ?? "",
        }),
      },
    });
  }
}
