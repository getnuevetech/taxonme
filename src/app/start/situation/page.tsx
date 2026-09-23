import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { SituationWorkspaceView } from "@/components/situation-workspace-view";

export default async function GuestSituationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();

  // Registering claims this Situation onto the account and deletes the guest
  // cookie, so a returning/logged-in visitor hitting this pre-signup link
  // (bookmark, browser back, a link they saved) would otherwise get a fresh,
  // empty guest session below and a false "not found" — send them to their
  // saved copy instead. Mirrors the same check already in /start/qa.
  const user = await getCurrentUser();
  if (user) {
    const owned = await db.situation.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    redirect(owned ? `/app/situations/${owned.id}` : "/app/situations");
  }

  const guest = await getOrCreateGuestSession();
  const row = await db.situation.findFirst({
    where: { id, guestSessionId: guest.id },
    include: {
      prepPlans: { orderBy: { createdAt: "desc" }, take: 1 },
      documents: { where: { deletedAt: null }, select: { id: true, fileName: true }, orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!row) {
    // Not a dead link — it was already claimed by an account (a different
    // device, or this session logged out since), so say so instead of a bare
    // 404 that reads as "your situation is gone."
    const claimed = await db.situation.findUnique({ where: { id }, select: { userId: true } });
    if (claimed?.userId) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">This situation is saved to an account</h1>
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
        isGuest
        canBuildPrepPlan={false}
        prepPlanBlockedReason="guest"
        documents={row.documents}
      />
      <p className="mt-8 text-center text-sm text-slate-500">
        <a href={`/register?next=${encodeURIComponent(`/app/situations/${row.id}`)}`} className="font-medium text-indigo-700 hover:underline">
          Create an account
        </a>{" "}
        to save this Situation and continue later.
      </p>
    </main>
  );
}
