import type { AnswerBranch, ConversationIntelligence } from "./types";

export type AssistantViewSection =
  | { type: "paragraph"; text: string }
  | { type: "branches"; intro: string; branches: AnswerBranch[] }
  | { type: "ask"; question: string; reason: string }
  | { type: "disclaimer"; text: string };

const DISCLAIMER =
  "This is general tax information based on public IRS frameworks, not legal, tax, or accounting advice. A CPA, EA, or tax attorney should review high-stakes decisions.";

/** Package AG — evidence-first branch ids (not resolution pathways). */
function isEvidenceFirstBranch(branch: AnswerBranch): boolean {
  return (
    branch.id === "establish_account_position" || branch.id === "use_existing_notice"
  );
}

/** Package AJ — notice/exam branch ids (not resolution pathways). */
function isNoticeExamBranch(branch: AnswerBranch): boolean {
  return branch.id === "respond_by_deadline" || branch.id === "verify_irs_figures";
}

function nonPathwayChrome(branches: AnswerBranch[]): boolean {
  if (!branches.length) return false;
  return branches.every((b) => isEvidenceFirstBranch(b) || isNoticeExamBranch(b));
}

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
      // Package AJ — identify + evidence (mirror AH seed); no bare agree/disagree menu.
      sections.push({
        type: "paragraph",
        text: "A CP2000 is an underreporter notice: the IRS compared third-party payer information (W-2s, 1099s, and similar) to your return and proposes changes. It is a proposed adjustment, not a bill by itself and not a field audit.",
      });
      sections.push({
        type: "paragraph",
        text: "Confirm the printed tax period, proposed amounts, and any respond-by date. Compare those figures to a Wage & Income transcript and your return, and confirm account activity on an Account Transcript before sizing a response. If unresolved, the IRS may later issue a Statutory Notice of Deficiency (CP3219A).",
      });
    } else if (/\bletter\s*3172\b/i.test(rawMessage)) {
      // Package AM — identify + evidence (mirror AL seed); lien ≠ levy / Form 12153.
      sections.push({
        type: "paragraph",
        text: "Letter 3172 notifies that the IRS has filed a Notice of Federal Tax Lien (NFTL) and typically states hearing rights tied to that lien filing. It is a lien-notice identity — not a final levy notice (LT11 / Letter 1058) and not Form 12153.",
      });
      sections.push({
        type: "paragraph",
        text: "Calendar any printed deadline on the letter you hold, keep it with any NFTL paperwork, and confirm the balance on an Account Transcript before sizing a response.",
      });
    } else if (/\bnftl\b|notice of federal tax lien|federal tax lien/i.test(rawMessage)) {
      // Package AM — NFTL identify (mirror AL seed).
      sections.push({
        type: "paragraph",
        text: "A Notice of Federal Tax Lien (NFTL) is a public filing recording the IRS claim against property for unpaid tax. Letter 3172 is the common taxpayer letter that an NFTL was filed. An NFTL is not the same as an LT11 levy notice and not Form 12153.",
      });
      sections.push({
        type: "paragraph",
        text: "Confirm tax periods and account position on an Account Transcript; calendar any deadline on the Letter 3172 or lien notice you actually received.",
      });
    } else if (/\bcp\s?-?501\b/i.test(rawMessage)) {
      // Package AP — identify + evidence (mirror AF seed); early reminder ≠ LT11.
      sections.push({
        type: "paragraph",
        text: "A CP501 is typically an early reminder that a balance remains unpaid after a first balance-due notice such as a CP14. It usually restates tax, penalties, and interest and asks for a response — it is not the final levy notice by itself.",
      });
      sections.push({
        type: "paragraph",
        text: "Confirm the printed amount, tax period, and any respond-by language. Compare those figures to an Account Transcript. Later reminders in the same series often include CP503 and CP504; LT11 / Letter 1058 is a separate final levy notice.",
      });
    } else if (/\bcp\s?-?503\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "An IRS CP503 is a collection reminder notice. It generally means the IRS believes you still owe a balance and is continuing collection contact — it is not the final levy notice by itself.",
      });
    } else if (/\bcp\s?-?504\b/i.test(rawMessage)) {
      // Package AP — identify + evidence (mirror Z seed); urgent levy warning ≠ LT11 CDP.
      sections.push({
        type: "paragraph",
        text: "A CP504 is an urgent collection notice that the IRS may levy if the balance is not addressed. It usually lists the amount due and a short response window — it is not the same as an LT11 / Letter 1058 final levy notice with Collection Due Process hearing rights.",
      });
      sections.push({
        type: "paragraph",
        text: "Calendar any printed deadline, keep the notice, and confirm the account position on an Account Transcript before sizing a response.",
      });
    } else if (/\bcp\s?-?90\b/i.test(rawMessage)) {
      // Package AR — identify + evidence (mirror AQ seed); ACS final levy ≠ CP504; ≠ Form 12153.
      sections.push({
        type: "paragraph",
        text: "A CP90 is typically an Automated Collection System (ACS) final notice of intent to levy that notifies of Collection Due Process (CDP) hearing rights. It is in the same rights family as LT11 / Letter 1058 — different letter codes — and it is not a CP504 urgent warning alone.",
      });
      sections.push({
        type: "paragraph",
        text: "Calendar any printed deadline on the CP90 you hold, keep the notice, and confirm the balance on an Account Transcript. Form 12153 is the named CDP hearing-request form — holding a CP90 is not the same as having filed Form 12153.",
      });
    } else if (/\b(lt\s?-?11|final\s+notice|intent\s+to\s+levy)\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "This kind of collection notice is a serious step toward levy. Calendar any deadline and confirm the balance on your IRS Account Transcript before choosing a response.",
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
    const evidenceFirst = intel.strategy.branches.some((b) => b.id === "establish_account_position");
    const noticeExam = /\bcp\s?-?2000\b|\bcp\s?-?3219a\b/i.test(rawMessage);
    const collectionLadder = /\bcp\s?-?501\b|\bcp\s?-?504\b/i.test(rawMessage);
    const finalLevyAcs = /\bcp\s?-?90\b/i.test(rawMessage);
    const lienNotice = /\bletter\s*3172\b|\bnftl\b|notice of federal tax lien|federal tax lien/i.test(
      rawMessage,
    );
    sections.push({
      type: "paragraph",
      text: evidenceFirst
        ? "Thanks for sharing that background. With the amount still unknown, the useful next step is establishing what the IRS currently shows on your account — then any next option can be sized to those facts."
        : noticeExam
          ? "Thanks for sharing that. Start by identifying the notice code, tax period, proposed amounts, and any respond-by or petition deadline — then confirm those figures against transcripts before sizing a response."
          : collectionLadder
            ? "Thanks for sharing that. Start by confirming the CP501 or CP504 code, tax period, printed amount, and any respond-by date — then compare those figures to an Account Transcript before sizing a response. A CP504 levy warning is not the same as an LT11 final levy notice."
            : finalLevyAcs
              ? "Thanks for sharing that. Start by confirming it is a CP90 ACS final levy notice (CDP rights family with LT11 / Letter 1058, not a CP504 warning alone), calendar any printed deadline, and confirm the Account Transcript — then any next option can be sized to those facts."
              : lienNotice
                ? "Thanks for sharing that. Start by confirming it is a lien notice (Letter 3172 / NFTL) rather than a levy notice (LT11), calendar any printed deadline, and confirm the Account Transcript — then any next option can be sized to those facts."
                : "Thanks for sharing that background. I can help outline payment or relief pathways, explain a notice, or — if something is already before the IRS or a state tax agency — help you track that agency matter.",
    });
  } else if (!(intel.strategy.branch_before_clarify && intel.strategy.branches.length)) {
    sections.push({
      type: "paragraph",
      text: `Here is a direct answer to: ${intel.question_contract.interpreted_question || intel.question_contract.explicit_question}`,
    });
  }

  if (intel.strategy.branch_before_clarify && intel.strategy.branches.length) {
    // Package AG/AJ: evidence-only and notice/exam branches are not "pathways" chrome.
    const skipPathwayChrome = nonPathwayChrome(intel.strategy.branches);
    const intro = skipPathwayChrome
      ? "What usually helps next"
      : target === "identify_available_pathways" || intel.strategy.branches.length >= 2
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
      const skipPathwayChrome = nonPathwayChrome(intel.strategy.branches);
      sections.push({
        type: "ask",
        question: skipPathwayChrome
          ? ask.question
          : `To determine which pathway applies to you: ${ask.question}`,
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

export type DecisionFocusOpts = {
  /** Package AJ — evidence-first or notice/exam branches (not resolution pathways). */
  nonPathwayChrome?: boolean;
};

/** Short customer-facing label for the active decision target. */
export function decisionFocusLabel(
  decisionTarget: string,
  opts?: DecisionFocusOpts,
): string {
  switch (decisionTarget) {
    case "petition_eligibility_overview":
      return "Who can help file or respond";
    case "identify_available_pathways":
      // Package AJ: thin evidence / notice-exam must not read as a pathway menu.
      return opts?.nonPathwayChrome
        ? "What to confirm about your account"
        : "Which tax pathways may be available";
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

/** Focus label from stored/live ConversationIntelligence (Package AJ). */
export function decisionFocusLabelFromIntel(intel: ConversationIntelligence): string {
  return decisionFocusLabel(intel.question_contract.decision_target, {
    nonPathwayChrome: nonPathwayChrome(intel.strategy.branches),
  });
}
