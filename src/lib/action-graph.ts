import "server-only";
import { db } from "./db";
import { buildActionGraph } from "./evidence/actions-core";

const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function safeArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function rebuildActionGraph(caseId: string): Promise<void> {
  const [steps, facts, c] = await Promise.all([
    db.pathStep.findMany({ where: { caseId }, orderBy: { sortOrder: "asc" } }),
    db.evidenceFact.findMany({
      where: { caseId },
      select: { id: true, factKey: true, provenance: true, valueText: true, valueNumber: true, taxPeriod: true },
    }),
    db.case.findUnique({ where: { id: caseId }, select: { status: true } }),
  ]);

  const graph = buildActionGraph(
    steps.map((step) => ({
      id: step.id,
      actionKey: step.actionKey,
      title: step.title,
      description: step.description,
      status: step.status,
      sortOrder: step.sortOrder,
    })),
    facts,
    { professionalReviewRecommended: c?.status === "consultant_recommended" },
  );

  await db.caseActionNode.deleteMany({ where: { caseId } });
  // Dependencies are recorded against action nodes, so the source step ids are
  // mapped to node ids once every node exists.
  const nodeIdByStepId = new Map<string, string>();
  for (const node of graph) {
    const created = await db.caseActionNode.create({
      data: {
        caseId,
        actionKey: node.actionKey,
        normalizedPurpose: node.normalizedPurpose,
        title: node.title,
        description: node.description,
        priority: node.priority,
        dependsOnJson: "[]",
        resolvesJson: JSON.stringify(node.resolves),
        requiresJson: JSON.stringify(node.requires),
        status: node.status,
      },
    });
    nodeIdByStepId.set(node.sourceStepId, created.id);
  }
  for (const node of graph) {
    const dependsOn = node.dependsOnStepIds.map((stepId) => nodeIdByStepId.get(stepId)).filter(Boolean);
    if (dependsOn.length === 0) continue;
    const nodeId = nodeIdByStepId.get(node.sourceStepId);
    if (!nodeId) continue;
    await db.caseActionNode.update({ where: { id: nodeId }, data: { dependsOnJson: JSON.stringify(dependsOn) } });
  }

  // An investigation the evidence already completed must disappear from the
  // customer's path forward, not linger as an unchecked task.
  const completedStepIds = graph
    .filter((node) => node.status === "COMPLETED" && node.satisfiedByFactIds.length > 0)
    .map((node) => node.sourceStepId);
  if (completedStepIds.length > 0) {
    await db.pathStep.updateMany({ where: { id: { in: completedStepIds }, status: { not: "done" } }, data: { status: "done" } });
  }
}

export async function rebuildIssueClusters(caseId: string, analysisVersionId?: string): Promise<void> {
  const [issues, actionNodes] = await Promise.all([
    db.issue.findMany({ where: { caseId }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
    db.caseActionNode.findMany({ where: { caseId }, orderBy: { priority: "asc" } }),
  ]);
  const grouped = new Map<string, typeof issues>();
  for (const issue of issues) {
    const key = `${issue.issueType || "UNCLASSIFIED_TAX_ISSUE"}:${issue.taxYear ?? "all"}`;
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
  }
  await db.caseIssueCluster.deleteMany({ where: { caseId } });
  const clusters = Array.from(grouped.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));
      return { key, items: sorted, primary: sorted[0] };
    })
    .sort((a, b) => (priorityRank[a.primary.priority] ?? 9) - (priorityRank[b.primary.priority] ?? 9));
  for (const [index, cluster] of clusters.entries()) {
    await db.caseIssueCluster.create({
      data: {
        caseId,
        analysisVersionId,
        clusterKey: cluster.key,
        title: cluster.primary.title,
        category: cluster.primary.issueType || "UNCLASSIFIED_TAX_ISSUE",
        status: cluster.primary.evidenceStatus.toUpperCase(),
        evidenceStrength: cluster.primary.evidenceStrength.toUpperCase(),
        issueIdsJson: JSON.stringify(cluster.items.map((i) => i.id)),
        unknownsJson: JSON.stringify(cluster.items.flatMap((i) => safeArray(i.unclearJson))),
        possibleExplanationsJson: JSON.stringify(cluster.items.flatMap((i) => safeArray(i.explanationsJson))),
        actionsJson: JSON.stringify(actionNodes.slice(0, 5).map((a) => a.id)),
        sortOrder: index,
      },
    });
  }
}

export async function rebuildCaseIssueAndActionGraph(caseId: string, analysisVersionId?: string): Promise<void> {
  await rebuildActionGraph(caseId);
  await rebuildIssueClusters(caseId, analysisVersionId);
}
