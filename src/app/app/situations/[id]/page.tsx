import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SituationWorkspaceView } from "@/components/situation-workspace-view";
import { getPrepPlanQuota } from "@/lib/billing-quotas";

export default async function SituationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const row = await db.situation.findFirst({
    where: { id, userId: user.id },
    include: { prepPlans: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!row) notFound();

  const quota = await getPrepPlanQuota(user.id);
  const prepPlanBlockedReason = !quota.hasAccess
    ? ("upgrade" as const)
    : quota.overLimit
      ? ("limit" as const)
      : null;

  return (
    <SituationWorkspaceView
      id={row.id}
      number={row.number}
      title={row.title}
      originalNarrative={row.originalNarrative}
      goal={row.goal}
      assistantReply={row.assistantReply}
      intelligenceJson={row.intelligenceJson}
      currentPathwaysJson={row.currentPathwaysJson}
      createdAt={row.createdAt}
      existingPrepPlanId={row.prepPlans[0]?.id ?? null}
      canBuildPrepPlan={!prepPlanBlockedReason}
      prepPlanBlockedReason={prepPlanBlockedReason}
    />
  );
}
