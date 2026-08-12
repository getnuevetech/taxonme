import { db } from "@/lib/db";
import { nextClarifyQuestion } from "@/lib/clarify";
import { ClarifyAnswerForm } from "./clarify-answer-form";

// The clarifying interview card: chat-style Q&A that gathers the specific
// facts the analysis is missing. Every answer re-runs the analysis.
export async function CaseClarify({ caseId }: { caseId: string }) {
  const [messages, question] = await Promise.all([
    db.caseClarifyMessage.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } }),
    nextClarifyQuestion(caseId),
  ]);
  if (!question && messages.length === 0) return null;

  return (
    <section id="clarify" className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {question ? "Sharpen your analysis — a few quick questions" : "Interview complete"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {question
              ? "Your answers feed straight into the analysis: amounts, dates, and details you give here update the findings above automatically."
              : "Every answer has been folded into your analysis. Add documents anytime to strengthen it further."}
          </p>
        </div>
        {question && (
          <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
            {messages.filter((m) => m.role === "user").length} answered
          </span>
        )}
      </div>

      {messages.length > 0 && (
        <details className="mt-3" open={messages.length <= 4}>
          <summary className="cursor-pointer text-xs font-medium text-indigo-600">
            Conversation so far ({messages.filter((m) => m.role === "user").length} answer{messages.filter((m) => m.role === "user").length === 1 ? "" : "s"})
          </summary>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm bg-white text-slate-700 ring-1 ring-slate-200"
                }`}>
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {question ? (
        <div className="mt-4">
          <div className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200">
              {question.text}
            </p>
          </div>
          <div className="mt-3">
            <ClarifyAnswerForm caseId={caseId} />
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ All caught up — the analysis above reflects everything you&apos;ve told us.
        </p>
      )}
    </section>
  );
}
