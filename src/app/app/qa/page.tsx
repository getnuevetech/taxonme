import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { qaSuggestionsForUser } from "@/lib/qa-suggestions";
import { STARTER_PROMPTS } from "@/lib/conversation/starter-prompts";

export const metadata = { title: "Ask the assistant" };

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const [threads, suggestions] = await Promise.all([
    db.qaThread.findMany({
      where: { userId: user.id, kind: "qa" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    qaSuggestionsForUser(user.id),
  ]);
  const starterSuggestions = suggestions.length ? suggestions : [...STARTER_PROMPTS];

  return (
    <div>
      <PageHeader title="Ask the assistant" subtitle="Plain-English answers about your cases, documents, notices, or general tax topics." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QaChat
            threadId=""
            messages={[]}
            suggestions={starterSuggestions}
            defaultQuestion={q?.trim() || ""}
            showPromoteCta
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent conversations</h2>
          <div className="space-y-2">
            {threads.length === 0 && <p className="text-sm text-slate-400">No conversations yet.</p>}
            {threads.map((t) => (
              <Link key={t.id} href={`/app/qa/${t.id}`} className="block">
                <Card className="transition hover:border-indigo-300">
                  <CardBody className="!p-3">
                    <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.createdAt.toLocaleDateString("en-US")}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
