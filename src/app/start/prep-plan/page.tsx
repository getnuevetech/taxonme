import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { PrepPlanWorkspaceView } from "@/components/prep-plan-workspace-view";

export default async function GuestPrepPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();

  // Same reasoning as /start/situation: a returning/logged-in visitor hitting
  // this pre-signup link would otherwise get a fresh, empty guest session
  // below and a false "not found" — send them to their saved copy instead.
  const user = await getCurrentUser();
  if (user) {
    const owned = await db.prepPlan.findFirst({ where: { id, situation: { userId: user.id } }, select: { id: true } });
    redirect(owned ? `/app/prep-plans/${owned.id}` : "/app/situations");
  }

  const guest = await getOrCreateGuestSession();
  const plan = await db.prepPlan.findFirst({
    where: { id, situation: { guestSessionId: guest.id } },
    include: { situation: { select: { id: true, number: true, title: true } } },
  });
  if (!plan) {
    // Not a dead link — it was already claimed by an account, so say so
    // instead of a bare 404 that reads as "your plan is gone."
    const claimed = await db.prepPlan.findUnique({
      where: { id },
      select: { situation: { select: { userId: true } } },
    });
    if (claimed?.situation.userId) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">This Prep Plan is saved to an account</h1>
          <p className="mt-2 text-slate-600">Log in to pick up where you left off.</p>
          <a
            href={`/login?next=${encodeURIComponent("/app/situations")}`}
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Log in →
          </a>
        </main>
      );
    }
    notFound();
  }

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
