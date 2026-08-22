import "server-only";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS, STAGE_KEYS } from "@/lib/constants";
import { runTrackedStage } from "@/lib/ai/orchestrator";
import { extractUserFacingText } from "@/lib/ai/validation";
import { buildEvidenceBrief } from "@/lib/evidence/brief";

export type ImpactResult = {
  relevance: "high" | "medium" | "low" | "none" | "unknown";
  summary: string;
  whatChanged: string;
  recommendedActions: string[];
  analysisJson: Record<string, unknown>;
};

function normalizeRelevance(raw: unknown): ImpactResult["relevance"] {
  const v = String(raw ?? "").toLowerCase();
  if (v === "high" || v === "medium" || v === "low" || v === "none") return v;
  return "unknown";
}

function deterministicImpact(args: {
  title: string;
  summary: string;
  situation: string;
  goal: string;
  issues: string[];
}): ImpactResult {
  const hay = `${args.title} ${args.summary}`.toLowerCase();
  const caseText = `${args.situation} ${args.goal} ${args.issues.join(" ")}`.toLowerCase();
  const tokens = hay.split(/[^a-z0-9]+/).filter((t) => t.length > 4).slice(0, 20);
  const hits = tokens.filter((t) => caseText.includes(t));
  const relevance = hits.length >= 4 ? "medium" : hits.length >= 1 ? "low" : "none";
  if (relevance === "none") {
    return {
      relevance,
      summary: "This update does not appear to change anything material in your current case.",
      whatChanged: "No clear overlap with your open issues or stated goal.",
      recommendedActions: ["Keep watching for updates that mention your notice type, tax year, credits, or payment plan."],
      analysisJson: { mode: "deterministic", hits },
    };
  }
  return {
    relevance,
    summary: `This update may touch topics related to your case (${hits.slice(0, 4).join(", ")}). Review the full release and confirm whether your tax situation is affected.`,
    whatChanged: "Possible overlap with language in your case summary or open findings.",
    recommendedActions: [
      "Read the official IRS source linked on this update.",
      "Check whether any deadline, interest rate, credit, or collection rule mentioned applies to your case.",
      "If it does, add the detail to your case so the analysis can refresh.",
    ],
    analysisJson: { mode: "deterministic", hits },
  };
}

export async function userCanSeeCaseImpact(userId: string): Promise<boolean> {
  return hasFeature(userId, FEATURE_KEYS.UPDATES_CASE_IMPACT);
}

export async function analyzeUpdateImpactForCase(opts: {
  userId: string;
  caseId: string;
  updateId: string;
  force?: boolean;
}): Promise<ImpactResult | null> {
  if (!(await userCanSeeCaseImpact(opts.userId))) return null;

  const existing = await db.caseUpdateImpact.findUnique({
    where: { userId_caseId_updateId: { userId: opts.userId, caseId: opts.caseId, updateId: opts.updateId } },
  });
  if (existing && !opts.force) {
    let analysisJson: Record<string, unknown> = {};
    try {
      analysisJson = JSON.parse(existing.analysisJson || "{}");
    } catch {
      analysisJson = {};
    }
    return {
      relevance: normalizeRelevance(existing.relevance),
      summary: existing.summary,
      whatChanged: String(analysisJson.whatChanged ?? ""),
      recommendedActions: Array.isArray(analysisJson.recommendedActions)
        ? analysisJson.recommendedActions.map(String)
        : [],
      analysisJson,
    };
  }

  const [c, update] = await Promise.all([
    db.case.findFirst({
      where: { id: opts.caseId, userId: opts.userId },
      include: {
        issues: { where: { state: { not: "resolved" } }, take: 8, select: { title: true, issueType: true } },
      },
    }),
    db.agencyUpdate.findFirst({ where: { id: opts.updateId, isPublished: true } }),
  ]);
  if (!c || !update) return null;

  const brief = await buildEvidenceBrief(c.id);
  const issueLines = c.issues.map((i) => `${i.issueType}: ${i.title}`);
  let result = deterministicImpact({
    title: update.title,
    summary: update.summary || update.body,
    situation: c.situation,
    goal: c.goal,
    issues: issueLines,
  });

  try {
    const outcome = await runTrackedStage(STAGE_KEYS.QA, {
      input: `Analyze how this ${update.sourceAgency} update affects the customer's case.`,
      question: `Does this official update change anything about my case? Title: ${update.title}. Summary: ${update.summary || update.body}`,
      knowledge: `${update.title}\n${update.body || update.summary}\nSource: ${update.sourceUrl}`,
      irs_sources: `${update.sourceAgency} update: ${update.title}`,
      user_context: `Case "${c.title}". Goal: ${c.goal}. Situation: ${c.situation}. Open issues: ${issueLines.join("; ") || "none"}.`,
      case_evidence: brief.text,
      tax_year_or_context: update.sourceAgency,
      claims: update.body || update.summary,
      verified_answer: "(prefer official update text; do not invent new rules)",
    }, { sequentialContext: true, metadata: { helper: "agency_update_impact", userId: opts.userId, caseId: c.id, updateId: update.id } });

    const final = outcome.stepOutputs.at(-1);
    const text = final ? extractUserFacingText(final.data, final.rawText) : "";
    const data = (final?.data ?? {}) as Record<string, unknown>;
    if (text.trim()) {
      result = {
        relevance: normalizeRelevance(data.relevance ?? result.relevance),
        summary: String(data.summary ?? text).slice(0, 1200),
        whatChanged: String(data.what_changed ?? data.whatChanged ?? result.whatChanged).slice(0, 1200),
        recommendedActions: Array.isArray(data.recommended_actions)
          ? data.recommended_actions.map(String).slice(0, 6)
          : Array.isArray(data.recommendedActions)
            ? data.recommendedActions.map(String).slice(0, 6)
            : result.recommendedActions,
        analysisJson: { ...(typeof data === "object" ? data : {}), mode: "ai", raw: text.slice(0, 2000) },
      };
    }
  } catch (err) {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("warning", "irs_impact", "Case impact analysis fell back to deterministic scoring", String(err), opts.userId);
  }

  await db.caseUpdateImpact.upsert({
    where: { userId_caseId_updateId: { userId: opts.userId, caseId: opts.caseId, updateId: opts.updateId } },
    update: {
      relevance: result.relevance,
      summary: result.summary,
      analysisJson: JSON.stringify({
        whatChanged: result.whatChanged,
        recommendedActions: result.recommendedActions,
        ...result.analysisJson,
      }),
    },
    create: {
      userId: opts.userId,
      caseId: opts.caseId,
      updateId: opts.updateId,
      relevance: result.relevance,
      summary: result.summary,
      analysisJson: JSON.stringify({
        whatChanged: result.whatChanged,
        recommendedActions: result.recommendedActions,
        ...result.analysisJson,
      }),
    },
  });

  return result;
}
