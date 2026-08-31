import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuestSession } from "@/lib/guest";
import { PrepPlanWorkspaceView } from "@/components/prep-plan-workspace-view";

export default async function GuestPrepPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();
  const guest = await getOrCreateGuestSession();
  const plan = await db.prepPlan.findFirst({
    where: { id, situation: { guestSessionId: guest.id } },
    include: { situation: { select: { id: true, number: true, title: true } } },
  });
  if (!plan) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
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
        isGuest
      />
      <p className="mt-8 text-center text-sm text-slate-500">
        <a href="/register" className="font-medium text-indigo-700 hover:underline">
          Create an account
        </a>{" "}
        to save this Prep Plan.
      </p>
    </main>
  );
}
