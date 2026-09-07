import {
  caseMustAnswerBeforeClarify,
  composeAssistantView,
  intelligenceForCase,
} from "@/lib/conversation";
import { AssistantReplyBlocks } from "@/components/assistant-reply";

/**
 * When the Case narrative is still question-shaped, answer first with Pipeline A
 * structured widgets before the clarify interview.
 */
export function CaseAnswerFirstPanel({
  situation,
  goal,
  intelligenceJson,
}: {
  situation: string;
  goal: string;
  intelligenceJson?: string | null;
}) {
  if (!caseMustAnswerBeforeClarify(situation, goal || "")) return null;
  const intel = intelligenceForCase({
    situation,
    goal,
    intelligenceJson,
  });
  const sections = composeAssistantView(intel, situation);
  if (!sections.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Answer first</h2>
      <p className="mt-1 text-sm text-slate-500">
        Based on what you already shared — clarify questions come after when they change the path.
      </p>
      <div className="mt-4">
        <AssistantReplyBlocks sections={sections} />
      </div>
    </section>
  );
}
