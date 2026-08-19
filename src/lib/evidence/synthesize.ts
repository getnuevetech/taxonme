import "server-only";
import { db } from "../db";
import { synthesizeCase, type CaseReconstruction } from "./synthesize-core";

// Builds and stores the case reconstruction. Analysts consume this instead of
// rediscovering the case from raw uploads on every run.

export async function synthesizeCaseReconstruction(
  caseId: string,
  analysisVersionId?: string,
): Promise<CaseReconstruction> {
  const [events, facts, accountStates, relationships, unknowns] = await Promise.all([
    db.caseEvent.findMany({ where: { caseId }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }),
    db.evidenceFact.findMany({ where: { caseId } }),
    db.accountPeriodState.findMany({ where: { caseId }, orderBy: { taxPeriod: "asc" } }),
    db.evidenceRelationship.findMany({ where: { caseId } }),
    db.caseUnknown.findMany({ where: { caseId, status: "ACTIVE" } }),
  ]);

  const reconstruction = synthesizeCase({
    events: events.map((event) => ({
      id: event.id,
      taxPeriod: event.taxPeriod,
      eventType: event.eventType,
      transactionCode: event.transactionCode,
      description: event.description,
      eventDate: event.eventDate,
      amount: event.amount,
    })),
    facts: facts.map((fact) => ({
      id: fact.id,
      factKey: fact.factKey,
      taxPeriod: fact.taxPeriod,
      valueNumber: fact.valueNumber,
      valueText: fact.valueText,
      effectiveDate: fact.effectiveDate,
      status: fact.status,
      provenance: fact.provenance,
    })),
    accountStates: accountStates.map((state) => ({
      taxPeriod: state.taxPeriod,
      currentBalance: state.currentBalance,
      currentBalanceAsOf: state.currentBalanceAsOf,
      currentStatus: state.currentStatus,
    })),
    relationships: relationships.map((relationship) => ({
      relationshipType: relationship.relationshipType,
      fromTaxPeriod: relationship.fromTaxPeriod,
      toTaxPeriod: relationship.toTaxPeriod,
      amount: relationship.amount,
      status: relationship.status,
      description: relationship.description,
    })),
    unknowns: unknowns.map((unknown) => ({
      label: unknown.label,
      question: unknown.question,
      reason: unknown.reason,
    })),
  });

  const established =
    reconstruction.established_relationships.length > 0 ||
    reconstruction.current_positions.length > 0 ||
    reconstruction.timeline.length > 0;

  await db.caseReconstruction.upsert({
    where: { caseId },
    update: {
      analysisVersionId: analysisVersionId ?? null,
      reconstructionJson: JSON.stringify(reconstruction),
      status: established ? "established" : "draft",
    },
    create: {
      caseId,
      analysisVersionId: analysisVersionId ?? null,
      reconstructionJson: JSON.stringify(reconstruction),
      status: established ? "established" : "draft",
    },
  });

  return reconstruction;
}
