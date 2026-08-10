import { db } from "@/lib/db";
import { getGuestSession } from "@/lib/guest";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { QaChat } from "@/components/qa-chat";

export const metadata = { title: "Ask a tax question" };

export default async function GuestQaPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadId } = await searchParams;
  const guest = await getGuestSession();
  const thread =
    threadId && guest
      ? await db.qaThread.findFirst({
          where: { id: threadId, guestSessionId: guest.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">Ask anything about taxes</h1>
          <p className="mt-2 text-slate-600">Plain-English answers. No question is too basic — that&apos;s the point.</p>
        </div>
        <QaChat threadId={thread?.id ?? ""} messages={thread?.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })) ?? []} />
      </main>
      <SiteFooter />
    </div>
  );
}
