import "server-only";
import { db } from "../db";
import { analyzeEvidenceRelationships, calculationToFact } from "./reconcile-core";
import { PROVENANCE } from "./types";

// Persists cross-document reconciliation. Relationships are recomputed from the
// current ledgers on every pass so a stale relationship can never outlive the
// evidence behind it.

export type ReconcileSummary = {
  relationshipsFound: number;
  confirmedRelationships: number;
  calculationsPerformed: number;
  balancesSuperseded: number;
};

export async function reconcileCaseEvidence(caseId: string): Promise<ReconcileSummary> {
  const [events, facts] = await Promise.all([
    db.caseEvent.findMany({ where: { caseId } }),
    db.evidenceFact.findMany({ where: { caseId } }),
  ]);

  const result = analyzeEvidenceRelationships(
    events.map((event) => ({
      id: event.id,
      taxPeriod: event.taxPeriod,
      eventType: event.eventType,
      amount: event.amount,
      eventDate: event.eventDate,
    })),
    facts.map((fact) => ({
      id: fact.id,
      factKey: fact.factKey,
      taxPeriod: fact.taxPeriod,
      valueNumber: fact.valueNumber,
      effectiveDate: fact.effectiveDate,
      provenance: fact.provenance,
      documentId: fact.documentId,
    })),
  );

  await db.evidenceRelationship.deleteMany({ where: { caseId } });
  if (result.relationships.length > 0) {
    await db.evidenceRelationship.createMany({
      data: result.relationships.map((relationship) => ({
        caseId,
        relationshipType: relationship.relationshipType,
        fromTaxPeriod: relationship.fromTaxPeriod,
        toTaxPeriod: relationship.toTaxPeriod,
        amount: relationship.amount,
        status: relationship.status,
        description: relationship.description,
        supportingFactIdsJson: JSON.stringify(relationship.supportingFactIds),
      })),
    });
  }

  // Our own arithmetic is evidence too, and it is recorded with its inputs.
  await db.evidenceFact.deleteMany({ where: { caseId, provenance: PROVENANCE.SYSTEM_CALCULATED } });
  if (result.calculations.length > 0) {
    await db.evidenceFact.createMany({
      data: result.calculations.map((calculation) => {
        const period = calculation.calculationId.split(":")[1] ?? "";
        const fact = calculationToFact(calculation, period);
        return {
          caseId,
          factKey: fact.factKey,
          factType: fact.factType,
          valueNumber: fact.valueNumber,
          valueText: fact.valueText,
          taxPeriod: fact.taxPeriod,
          provenance: fact.provenance,
          metadataJson: JSON.stringify(fact.metadata),
        };
      }),
    });
  }

  // Older balances stay in the ledger as history rather than being deleted or
  // treated as a conflict with the current figure.
  if (result.supersededFactIds.length > 0) {
    await db.evidenceFact.updateMany({
      where: { id: { in: result.supersededFactIds } },
      data: { status: "superseded" },
    });
  }

  for (const [period, current] of Object.entries(result.currentBalanceByPeriod)) {
    await db.accountPeriodState.updateMany({
      where: { caseId, taxPeriod: period },
      data: { currentBalance: current.value, currentBalanceAsOf: current.asOf, currentStatus: "balance_established" },
    });
  }

  return {
    relationshipsFound: result.relationships.length,
    confirmedRelationships: result.relationships.filter((r) => r.status === "CONFIRMED").length,
    calculationsPerformed: result.calculations.length,
    balancesSuperseded: result.supersededFactIds.length,
  };
}
