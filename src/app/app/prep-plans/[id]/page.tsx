import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PrepPlanWorkspaceView } from "@/components/prep-plan-workspace-view";

export default async function PrepPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const plan = await db.prepPlan.findFirst({
    where: { id, situation: { userId: user.id } },
    include: { situation: { select: { id: true, number: true, title: true } } },
  });
  if (!plan) notFound();

  return (
    <PrepPlanWorkspaceView
      id={plan.id}
      selectedPathway={plan.selectedPathway}
      eligibilityJson={plan.eligibilityJson}
      blockersJson={plan.blockersJson}
      filingsJson={plan.filingsJson}
      evidenceNeedsJson={plan.evidenceNeedsJson}
      sequenceJson={plan.sequenceJson}
      preparationStatus={plan.preparationStatus}
      situation={plan.situation}
    />
  );
}
