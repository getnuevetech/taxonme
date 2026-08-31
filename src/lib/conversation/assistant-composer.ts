import type { AnswerBranch, ConversationIntelligence } from "./types";

export type AssistantViewSection =
  | { type: "paragraph"; text: string }
  | { type: "branches"; intro: string; branches: AnswerBranch[] }
  | { type: "ask"; question: string; reason: string }
  | { type: "disclaimer"; text: string };

const DISCLAIMER =
  "This is general tax information based on public IRS frameworks, not legal, tax, or accounting advice. A CPA, EA, or tax attorney should review high-stakes decisions.";

/**
 * Structured assistant view for Pipeline A UI.
 * Domain-specific templates stay thin; layout owns presentation.
 */
export function composeAssistantView(
  intel: ConversationIntelligence,
  rawMessage: string,
): AssistantViewSection[] {
  const sections: AssistantViewSection[] = [];
  const target = intel.question_contract.decision_target;

  if (intel.strategy.mode === "clarify_first") {
    const ask = intel.need_to_know.find((item) => item.tier === "critical_now");
    sections.push({
      type: "paragraph",
      text:
        intel.answerability.clarify_first_reason ||
        "I need one clarifying detail before I can give a reliable answer.",
    });
    if (ask) sections.push({ type: "ask", question: ask.question, reason: ask.reason });
    return sections;
  }

  if (intel.strategy.mode === "document_needed" || intel.strategy.mode === "request_document") {
    sections.push({
      type: "paragraph",
      text: "Please upload or paste the IRS/state notice (or tell me the code at the top, like CP2000 or LT11). I can explain what it means once I can identify it — I do not need a full case file first.",
    });
    return sections;
  }

  if (intel.strategy.mode === "case_review" || intel.strategy.mode === "initiate_case") {
    sections.push({
      type: "paragraph",
      text: "You asked for a full review of a matter already before the IRS or another tax agency. I will use the matter-analysis tools for notices on file, balances, risks, and next actions.",
    });
    return sections;
  }

  if (target === "petition_eligibility_overview") {
    sections.push({
      type: "paragraph",
      text: "Yes — depending on the facts, a spouse or other responsible party can often be part of how a tax issue is handled (joint return liability, innocent spouse relief, or who should respond to a notice).",
    });
    sections.push({
      type: "paragraph",
      text: "What you should file or how you should respond still depends on the notice, tax year, and whether a return is already on file.",
    });
  } else if (target === "explain_document_or_notice") {
    if (/\bcp\s?-?2000\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "A CP2000 is an underreporter notice. The IRS compared third-party information (W-2/1099s, etc.) to your return and proposes changes — it is not a bill by itself until you agree or the IRS assesses.",
      });
      sections.push({
        type: "paragraph",
        text: "Deadlines on the notice matter. You can agree, partially agree, or disagree with documentation. Ignoring it often leads to assessment and collection contact.",
      });
    } else if (/\bcp\s?-?503\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "An IRS CP503 is a collection reminder notice. It generally means the IRS believes you still owe a balance and is continuing collection contact — it is not the final levy notice by itself.",
      });
    } else if (/\b(lt\s?-?11|final\s+notice|intent\s+to\s+levy)\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "This kind of collection notice is a serious step toward levy. Calendar any deadline, confirm the balance on transcript, and decide quickly between payment, an installment agreement, or another relief path.",
      });
    } else {
      sections.push({
        type: "paragraph",
        text: "I can explain the notice you referenced. Based on what you shared, here is the plain-English meaning and what usually comes next.",
      });
    }
  } else if (target === "document_checklist") {
    sections.push({
      type: "paragraph",
      text: "For resolving a balance or responding to a notice, people typically gather: the IRS notice, wage/income documents (W-2/1099), a copy of the return if filed, account transcripts, and proof of payments. Exact lists vary by notice type and relief path.",
    });
    sections.push({
      type: "paragraph",
      text: "You do not need to upload those documents for me to explain the checklist.",
    });
  } else if (target === "interpret_situation_offer_next_step") {
    sections.push({
      type: "paragraph",
      text: "Thanks for sharing that background. I can help outline payment or relief pathways, explain a notice, or — if something is already before the IRS or a state tax agency — help you track that agency matter.",
    });
  } else if (!(intel.strategy.branch_before_clarify && intel.strategy.branches.length)) {
    sections.push({
      type: "paragraph",
      text: `Here is a direct answer to: ${intel.question_contract.interpreted_question || intel.question_contract.explicit_question}`,
    });
  }

  if (intel.strategy.branch_before_clarify && intel.strategy.branches.length) {
    const intro =
      target === "identify_available_pathways" || intel.strategy.branches.length >= 2
        ? "Pathways that usually matter"
        : "What can apply";
    sections.push({ type: "branches", intro, branches: intel.strategy.branches });
  }

  if (
    intel.strategy.mode === "answer_then_targeted_question" ||
    intel.strategy.mode === "answer_then_targeted_questions"
  ) {
    if (intel.strategy.ask_now[0]) {
      const ask = intel.strategy.ask_now[0];
      sections.push({
        type: "ask",
        question: `To determine which pathway applies to you: ${ask.question}`,
        reason: ask.reason,
      });
    }
  }

  sections.push({ type: "disclaimer", text: DISCLAIMER });
  return sections;
}

/** Plain-text / acceptance-test scaffold — no markdown markers. */
export function composeAssistantReply(intel: ConversationIntelligence, rawMessage: string): string {
  return composeAssistantView(intel, rawMessage)
    .map((section) => {
      if (section.type === "paragraph" || section.type === "disclaimer") return section.text;
      if (section.type === "ask") {
        return `${section.question}\n\nWhy this matters: ${section.reason}`;
      }
      return [
        section.intro + ":",
        ...section.branches.map((branch) => `${branch.condition}: ${branch.explanation}`),
      ].join("\n\n");
    })
    .join("\n\n");
}

/** Short customer-facing label for the active decision target. */
export function decisionFocusLabel(decisionTarget: string): string {
  switch (decisionTarget) {
    case "petition_eligibility_overview":
      return "Who can help file or respond";
    case "identify_available_pathways":
      return "Which tax pathways may be available";
    case "explain_document_or_notice":
      return "What this notice or document means";
    case "document_checklist":
      return "Documents typically needed";
    case "status_guidance":
      return "How to read your tax account status";
    case "risk_overview":
      return "Material risks in your situation";
    case "comprehensive_case_strategy":
      return "Review of your agency matter";
    case "interpret_situation_offer_next_step":
      return "What you want help with next";
    case "answer_user_question":
      return "Answering your question";
    default:
      return "Understanding your request";
  }
}
