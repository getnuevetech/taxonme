import type { AssistantViewSection } from "@/lib/conversation";

/** Soft-format stored assistant text: **emphasis** → teal strong (monetization CTAs). */
export function AssistantMessageText({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) => {
        const match = /^\*\*([^*]+)\*\*$/.exec(part);
        if (match) {
          return (
            <strong key={index} className="font-semibold text-teal-700">
              {match[1]}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

/** Structured Pipeline A sections (widgets) — no markdown chrome. */
export function AssistantReplyBlocks({ sections }: { sections: AssistantViewSection[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-800">
      {sections.map((section, index) => {
        if (section.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {section.text}
            </p>
          );
        }
        if (section.type === "disclaimer") {
          return (
            <p key={index} className="text-xs text-slate-500">
              {section.text}
            </p>
          );
        }
        if (section.type === "ask") {
          return (
            <div
              key={index}
              className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                One fact that changes the path
              </p>
              <p className="mt-1 font-medium text-slate-900">{section.question}</p>
              <p className="mt-1 text-sm text-slate-600">{section.reason}</p>
            </div>
          );
        }
        return (
          <div key={index}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.intro}
            </p>
            <ul className="mt-3 space-y-3">
              {section.branches.map((branch) => (
                <li key={branch.id} className="border-l-2 border-indigo-500 pl-3">
                  <p className="font-medium text-slate-900">{branch.condition}</p>
                  <p className="text-sm text-slate-600">{branch.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
