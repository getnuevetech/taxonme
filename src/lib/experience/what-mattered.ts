/**
 * Phase −1.9 L2 — partition decision-changing facts from deferred schema facts.
 * This module emits institutional keys only.
 */
import type { NeedToKnowItem, QuestionContract } from "../conversation/types";

export const DISCARDED_EARLY_PATHWAY_FACTS = [
  "full_form_433_package",
  "complete_financial_statement",
  "exact_monthly_expenses",
  "asset_equity_details",
  "exact_offer_amount",
] as const;

export type WhatMatteredPartition = {
  facts_considered: string[];
  decision_changing_facts: string[];
  facts_discarded: string[];
  facts_not_needed_yet: string[];
};

export function extractSituationFeatures(message: string): string[] {
  const text = String(message ?? "").toLowerCase();
  const features: string[] = [];

  if (/\b(owe|balance due|back taxes?|tax debt)\b/.test(text)) {
    features.push("balance_due");
  }
  if (/\b(cp\s?-?503|cp\s?-?\d{3,4}|lt\s?-?\d+|collection notice|final notice)\b/.test(text)) {
    features.push("collection_notice");
  }
  if (/\b(not sure|unsure|don'?t know|uncertain).{0,35}\b(pay|afford|monthly)\b|\bmaybe.{0,20}(pay|afford)\b/.test(text)) {
    features.push("uncertain_ability_to_pay");
  } else if (/\b(can'?t pay|cannot pay|unable to pay|can pay|afford monthly|hardship)\b/.test(text)) {
    features.push("ability_to_pay_known");
  }
  if ((text.match(/\b20\d{2}\b/g) ?? []).length > 1) {
    features.push("multiple_tax_years");
  }
  if (/\b(what are my options|options|pathways|what can i do)\b/.test(text)) {
    features.push("asks_for_options");
  }
  return unique(features);
}

export function clarificationFactKey(question: string): string {
  const q = question.toLowerCase();
  if (/monthly payment|paying anything|ability to pay|can you pay|afford|hardship/.test(q)) {
    return "ability_to_pay";
  }
  if (/notice code|which notice|cp\d|lt\d/.test(q)) return "notice_identity";
  if (/tax year|which year/.test(q)) return "tax_years";
  if (/form\s*433|complete financial|all (?:income|expenses|assets)|every financial/.test(q)) {
    return "full_form_433_package";
  }
  if (/asset|equity/.test(q)) return "asset_equity_details";
  if (/monthly expenses|every expense/.test(q)) return "exact_monthly_expenses";
  return "targeted_clarification";
}

function deferredFactKeys(items: NeedToKnowItem[]): string[] {
  return unique(
    items
      .filter((item) => !(item.tier === "critical_now" && item.changes_branch))
      .map((item) => clarificationFactKey(item.question)),
  );
}

export function partitionWhatMattered(opts: {
  message: string;
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
  needToKnow?: NeedToKnowItem[];
  pathways?: string[];
}): WhatMatteredPartition {
  const features = extractSituationFeatures(opts.message);
  const askKeys = opts.askNow.map((item) => clarificationFactKey(item.question));
  const decisionChanging = opts.askNow
    .filter((item) => item.changes_branch)
    .map((item) => clarificationFactKey(item.question));

  if (features.includes("ability_to_pay_known")) {
    decisionChanging.push("ability_to_pay");
  }
  if (features.includes("collection_notice")) {
    decisionChanging.push("collection_stage");
  }

  const pathwayEarly =
    opts.contract.decision_target === "identify_available_pathways" ||
    opts.contract.decision_target === "identify_possible_pathways";
  const defaultDiscarded = pathwayEarly
    ? [...DISCARDED_EARLY_PATHWAY_FACTS]
    : ["complete_financial_statement"];
  const decision_changing_facts = unique(decisionChanging);
  const facts_discarded = unique([
    ...defaultDiscarded,
    ...deferredFactKeys(opts.needToKnow ?? []),
  ]).filter((key) => !decision_changing_facts.includes(key));

  return {
    facts_considered: unique([
      ...features,
      ...askKeys,
      ...facts_discarded,
      ...(opts.pathways ?? []).map((pathway) => `pathway:${pathway}`),
    ]),
    decision_changing_facts,
    facts_discarded,
    facts_not_needed_yet: facts_discarded,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
