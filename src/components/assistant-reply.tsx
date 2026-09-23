import type { AssistantViewSection } from "@/lib/conversation";
import {
  IconClock,
  IconShield,
  IconCompass,
  IconLetter,
  IconDocument,
  IconUsers,
  IconCheckCircle,
  IconSparkle,
} from "@/components/icons";

/** Inline **bold** spans within a line of plain text. */
function InlineEmphasis({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\*\*([^*]+)\*\*$/.exec(part);
        return match ? (
          <strong key={index} className="font-semibold text-teal-700">
            {match[1]}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

const DISCLAIMER_RE = /not (?:legal|professional|tax, or accounting) advice|general tax information|cpa, ea, or tax attorney/i;
const LABEL_LINE_RE = /^\*{0,2}([A-Z][^:]{2,70}):\*{0,2}\s*$/;
const IF_LEAD_RE = /^\*{0,2}(If\s[^:]{3,80}):\*{0,2}\s*/i;

const ICON_RULES: { pattern: RegExp; Icon: typeof IconClock }[] = [
  { pattern: /pay over time|installment|monthly payment/i, Icon: IconClock },
  { pattern: /cannot pay|hardship|currently not collectible/i, Icon: IconShield },
  { pattern: /settle|offer in compromise|less than the full|pathway/i, Icon: IconCompass },
  { pattern: /penalt/i, Icon: IconShield },
  { pattern: /notice|letter|\bcp\s?\d|\blt\s?\d/i, Icon: IconLetter },
  { pattern: /transcript|document|upload|1099|w-?2|1040/i, Icon: IconDocument },
  { pattern: /deadline|days\b|before\b|due\b/i, Icon: IconClock },
  { pattern: /professional|\bcpa\b|\bea\b|attorney/i, Icon: IconUsers },
  { pattern: /confirm|verified|established|next step/i, Icon: IconCheckCircle },
];

function iconFor(text: string) {
  return ICON_RULES.find((r) => r.pattern.test(text))?.Icon ?? IconSparkle;
}

/**
 * Soft-format stored assistant text into readable blocks: a short "Label:"
 * line becomes a section header, an "If X: ..." paragraph becomes an
 * icon-led option card, the disclaimer gets its own muted note, and the
 * scaffold/model divider disappears instead of showing as a literal "---".
 */
export function AssistantMessageText({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {paragraphs.map((paragraph, index) => {
        if (paragraph === "---") {
          return <div key={index} className="border-t border-slate-200/80" />;
        }

        if (DISCLAIMER_RE.test(paragraph)) {
          return (
            <p key={index} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <IconSparkle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{paragraph}</span>
            </p>
          );
        }

        const labelMatch = LABEL_LINE_RE.exec(paragraph);
        if (labelMatch) {
          const Icon = iconFor(labelMatch[1]);
          return (
            <p key={index} className="flex items-center gap-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Icon className="h-4 w-4 text-indigo-500" />
              {labelMatch[1]}
            </p>
          );
        }

        const ifMatch = IF_LEAD_RE.exec(paragraph);
        if (ifMatch) {
          const Icon = iconFor(paragraph);
          const rest = paragraph.slice(ifMatch[0].length).trim();
          return (
            <div key={index} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
              <p>
                <span className="font-semibold text-slate-900">{ifMatch[1]}:</span>{" "}
                <span className="text-slate-700">{rest}</span>
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineEmphasis text={paragraph} />
          </p>
        );
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
