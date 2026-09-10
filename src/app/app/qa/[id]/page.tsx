import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActivePlan } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { qaSuggestionsForUser } from "@/lib/qa-suggestions";
import {
  decisionFocusLabelFromIntel,
  parseStoredIntelligence,
} from "@/lib/conversation";
import { STARTER_PROMPTS } from "@/lib/conversation/starter-prompts";

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
  const intel = parseStoredIntelligence(thread.intelligenceJson);
  const focusLabel = intel ? decisionFocusLabelFromIntel(intel) : undefined;
  const interpretedQuestion = intel?.question_contract.interpreted_question || undefined;
  const promoteNarrative = encodeURIComponent(
    (intel?.question_contract.explicit_question || thread.title || "").slice(0, 500),
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title={thread.title} />
      <QaChat
        threadId={thread.id}
        messages={thread.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        suggestions={suggestions.length ? suggestions : [...STARTER_PROMPTS]}
        focusLabel={focusLabel}
        interpretedQuestion={interpretedQuestion}
        showUpgradeCta={planKey === "free"}
        showConsultantCta={planKey === "pro"}
        showPromoteCta
        promoteSituationHref={`/app/cases/new?prefill=${promoteNarrative}`}
        promoteCaseHref={`/app/cases/new?prefill=${promoteNarrative}`}
      />
    </div>
  );
}
