import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";

export const metadata = { title: "Ask the assistant" };

export default async function QaPage() {
  const user = await requireUser();
  const threads = await db.qaThread.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader title="Ask the assistant" subtitle="Plain-English answers about your taxes. Start a new conversation below." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QaChat threadId="" messages={[]} />
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
