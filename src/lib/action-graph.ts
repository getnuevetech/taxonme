import "server-only";
import { db } from "./db";
import { normalizeActionPurpose } from "./case-semantics";

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
  const steps = await db.pathStep.findMany({ where: { caseId }, orderBy: { sortOrder: "asc" } });
  const deduped = new Map<string, typeof steps[number]>();
  for (const step of steps) {
    if (!step.title || !step.description) continue;
    const purpose = normalizeActionPurpose(`${step.actionKey} ${step.title} ${step.description}`);
    if (!deduped.has(purpose)) deduped.set(purpose, step);
  }
  await db.caseActionNode.deleteMany({ where: { caseId } });
  const nodes = Array.from(deduped.entries());
  let previousActionNodeId: string | null = null;
  for (const [index, [purpose, step]] of nodes.entries()) {
    const created: { id: string } = await db.caseActionNode.create({
      data: {
        caseId,
        actionKey: step.actionKey || purpose,
        normalizedPurpose: purpose,
        title: step.title,
        description: step.description,
        priority: index + 1,
        dependsOnJson: previousActionNodeId ? JSON.stringify([previousActionNodeId]) : "[]",
        status: step.status === "done" ? "DONE" : step.status === "current" ? "READY" : "PENDING",
      },
    });
    previousActionNodeId = created.id;
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
