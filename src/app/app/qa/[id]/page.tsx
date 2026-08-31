import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActivePlan } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { qaSuggestionsForUser } from "@/lib/qa-suggestions";

export default async function QaThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const thread = await db.qaThread.findFirst({
    where: { id, userId: user.id, kind: "qa" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) notFound();
  const [suggestions, plan] = await Promise.all([
    qaSuggestionsForUser(user.id),
    getActivePlan(user.id),
  ]);
  const planKey = plan?.key ?? "free";

  return (
    <div className="max-w-3xl">
      <PageHeader title={thread.title} />
      <QaChat
        threadId={thread.id}
        messages={thread.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        suggestions={suggestions}
        showUpgradeCta={planKey === "free"}
        showConsultantCta={planKey === "pro"}
      />
    </div>
  );
}
