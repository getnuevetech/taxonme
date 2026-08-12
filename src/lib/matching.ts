import "server-only";
import { db } from "./db";
import { getBoolSetting } from "./settings";
import { STAGE_KEYS, CONSULTANT_SPECIALTIES } from "./constants";
import { callProvider, extractJson } from "./ai/adapters";

// Consultant matching engine: deterministic scoring over specialty fit,
// experience, and past cases handled, optionally re-ranked by an AI model,
// with a two-model pipeline writing the recommendation reason shown to both
// parties. Admin can enable/disable auto-assignment and always override.

// Issue types → consultant specialties they map to.
const ISSUE_SPECIALTY_MAP: Record<string, string[]> = {
  refund_discrepancy: ["refunds", "notices"],
  balance_due: ["back_taxes", "payment_plans"],
  missing_return: ["back_taxes"],
  notice_response: ["notices", "audits"],
  penalty: ["penalties"],
  other: ["notices"],
};

type Candidate = {
  userId: string;
  name: string;
  email: string;
  credentialType: string;
  yearsExperience: number;
  specialties: string[];
  experiences: string;
  pastCases: { title: string; category: string; outcome: string; year: number | null }[];
  activeLoad: number;
  score: number;
};

export async function rankConsultantsForCase(caseId: string): Promise<Candidate[]> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { issues: true },
  });
  if (!c) return [];
  const issueTypes = Array.from(new Set(c.issues.map((i) => i.issueType)));
  const wantedSpecialties = new Set(issueTypes.flatMap((t) => ISSUE_SPECIALTY_MAP[t] ?? []));
  // Payment-plan goals matter even when no balance_due issue was extracted.
  if (/(payment plan|installment|afford)/i.test(`${c.situation} ${c.goal}`)) wantedSpecialties.add("payment_plans");

  const consultants = await db.user.findMany({
    where: { role: "consultant", status: "active", consultantProfile: { status: "approved" } },
    include: {
      consultantProfile: { include: { pastCases: true } },
      consultantAssignments: { where: { status: { in: ["proposed", "user_accepted", "active"] } }, select: { id: true } },
    },
  });

  const candidates: Candidate[] = consultants.map((u) => {
    const p = u.consultantProfile!;
    const specialties: string[] = JSON.parse(p.specialties || "[]");
    const pastCases = p.pastCases.map((pc) => ({ title: pc.title, category: pc.category, outcome: pc.outcome, year: pc.year }));

    let score = 0;
    for (const s of specialties) if (wantedSpecialties.has(s)) score += 3;
    score += Math.min(p.yearsExperience, 10) * 0.3;
    if (p.credentialType === "cpa" || p.credentialType === "ea") score += 1.5;
    for (const pc of pastCases) {
      if (wantedSpecialties.has(pc.category) || issueTypes.includes(pc.category)) score += 1;
      else score += 0.2; // any track record counts a little
    }
    score -= u.consultantAssignments.length * 0.5; // workload balancing

    return {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      credentialType: p.credentialType,
      yearsExperience: p.yearsExperience,
      specialties,
      experiences: p.experiences,
      pastCases,
      activeLoad: u.consultantAssignments.length,
      score: Math.round(score * 10) / 10,
    };
  });

  return candidates.sort((a, b) => b.score - a.score);
}

async function getStageSteps(stageKey: string) {
  const stage = await db.pipelineStage.findUnique({
    where: { key: stageKey },
    include: { steps: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" }, include: { provider: true } } },
  });
  return (stage?.isEnabled ? stage.steps : []).filter((s) => s.provider.isEnabled && s.provider.apiKey);
}

function caseSummaryText(c: { title: string; situation: string; goal: string }, issueTypes: string[]): string {
  return `Title: ${c.title}\nIssues: ${issueTypes.join(", ") || "unknown"}\nSituation: ${c.situation.slice(0, 800)}\nGoal: ${c.goal.slice(0, 300)}`;
}

export function credentialLabel(type: string): string {
  return type === "cpa" ? "CPA" : type === "ea" ? "Enrolled Agent" : "Tax Consultant";
}

const ISSUE_TYPE_PHRASES: Record<string, string> = {
  refund_discrepancy: "a refund discrepancy",
  balance_due: "a balance due the client can't pay in full",
  missing_return: "an unfiled tax return",
  notice_response: "an IRS notice that needs a response",
  penalty: "IRS penalties",
  other: "a general tax issue",
};

// Case-focused routing explanation shown to the CONSULTANT. Talks about the
// client's case, not the consultant's own profile.
export function caseRoutingReason(issueTypes: string[], consultantSpecialties: string[]): string {
  const uniqueTypes = Array.from(new Set(issueTypes));
  const phrases = uniqueTypes.map((t) => ISSUE_TYPE_PHRASES[t] ?? "a tax issue");
  const list = phrases.length > 1 ? `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}` : phrases[0] ?? "a tax situation";

  const wanted = new Set(uniqueTypes.flatMap((t) => ISSUE_SPECIALTY_MAP[t] ?? []));
  const matched = consultantSpecialties.filter((s) => wanted.has(s));
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return matched.length
    ? `This case involves ${list} — work that falls within your listed specialties (${matched.map(specialtyName).join(", ")}).`
    : `This case involves ${list}, and you had capacity to take it on.`;
}

function candidateText(cd: Candidate): string {
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;
  return [
    `id: ${cd.userId}`,
    `name: ${cd.name}`,
    `credential: ${cd.credentialType.toUpperCase()}`,
    `years_experience: ${cd.yearsExperience}`,
    `specialties: ${cd.specialties.map(specialtyName).join(", ") || "none listed"}`,
    cd.experiences ? `experience_notes: ${cd.experiences.slice(0, 400)}` : "",
    cd.pastCases.length
      ? `past_cases: ${cd.pastCases.slice(0, 6).map((pc) => `${pc.title} [${pc.category}]${pc.outcome ? ` — ${pc.outcome}` : ""}`).join(" | ")}`
      : "past_cases: none recorded",
    `current_active_clients: ${cd.activeLoad}`,
    `match_score: ${cd.score}`,
  ].filter(Boolean).join("\n");
}

/**
 * Pick the best consultant for a case: deterministic ranking first, optionally
 * re-ranked by the AI "match" stage over the top candidates.
 */
export async function pickConsultantForCase(caseId: string): Promise<Candidate | null> {
  const ranked = await rankConsultantsForCase(caseId);
  if (ranked.length === 0) return null;
  const c = await db.case.findUnique({ where: { id: caseId }, include: { issues: true } });
  if (!c) return null;
  const issueTypes = Array.from(new Set(c.issues.map((i) => i.issueType)));

  const steps = await getStageSteps(STAGE_KEYS.MATCH);
  if (steps.length > 0 && ranked.length > 1) {
    const top = ranked.slice(0, 5);
    for (const step of steps) {
      try {
        const prompt = step.promptTemplate
          .replace("{{case}}", caseSummaryText(c, issueTypes))
          .replace("{{candidates}}", top.map(candidateText).join("\n\n---\n\n"));
        const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
        const parsed = extractJson(result.text);
        const chosen = parsed && top.find((t) => t.userId === String(parsed.consultant_id));
        if (chosen) return chosen;
      } catch (err) {
        const { logSystem } = await import("./syslog");
        await logSystem("error", "ai_call", `${step.provider.name} failed re-ranking consultant matches`, String(err));
      }
    }
  }
  return ranked[0];
}

/**
 * Two-model recommendation reason: the first model drafts a summary + detailed
 * outline; the second independently reviews and refines it. Deterministic
 * fallback builds the reason from the matching facts.
 */
export async function generateAssignmentReason(
  caseId: string,
  candidate: Candidate,
): Promise<{ summary: string; detail: string }> {
  const c = await db.case.findUnique({ where: { id: caseId }, include: { issues: true } });
  const issueTypes = c ? Array.from(new Set(c.issues.map((i) => i.issueType))) : [];
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  const fallback = () => {
    const matched = candidate.specialties.filter((s) =>
      issueTypes.some((t) => (ISSUE_SPECIALTY_MAP[t] ?? []).includes(s)),
    );
    const cred = credentialLabel(candidate.credentialType);
    const summary = `${candidate.name} (${cred}, ${candidate.yearsExperience} yrs) specializes in ${matched.length ? matched.map(specialtyName).join(" and ") : "tax resolution"}, which matches this case.`;
    const detail = [
      `- Credential: ${cred} with ${candidate.yearsExperience} years of professional tax experience.`,
      matched.length ? `- Specialty match: ${matched.map(specialtyName).join(", ")} — directly relevant to the issues in this case (${issueTypes.map((t) => t.replace(/_/g, " ")).join(", ")}).` : `- Broad tax-resolution background relevant to this case.`,
      candidate.pastCases.length ? `- Track record: ${candidate.pastCases.length} past case(s) recorded, including ${candidate.pastCases[0].title}.` : `- Available capacity: currently handling ${candidate.activeLoad} active client(s).`,
      `- Workload: ${candidate.activeLoad} active client(s) — capacity to take this case now.`,
    ].join("\n");
    return { summary, detail };
  };

  if (!c) return fallback();
  const steps = await getStageSteps(STAGE_KEYS.MATCH_REASON);
  if (steps.length === 0) return fallback();

  const caseText = caseSummaryText(c, issueTypes);
  const consultantText = candidateText(candidate);
  let draft = "";
  let best: { summary: string; detail: string } | null = null;

  for (const step of steps) {
    try {
      const prompt = step.promptTemplate
        .replace("{{case}}", caseText)
        .replace("{{consultant}}", consultantText)
        .replace("{{prior}}", draft || "(no draft yet — write the first version)");
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      const parsed = extractJson(result.text);
      if (parsed && typeof parsed.summary === "string" && parsed.summary) {
        best = { summary: String(parsed.summary).slice(0, 300), detail: String(parsed.detailed_reason ?? "").slice(0, 2000) };
        draft = result.text;
      }
    } catch (err) {
      const { logSystem } = await import("./syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed writing the assignment reason`, String(err));
    }
  }
  return best ?? fallback();
}

/**
 * Auto-assign a consultant when a case is flagged for professional review.
 * Respects the admin toggle; both parties still have to consent; admin can
 * revoke/override from the Assignments page.
 */
export async function autoAssignConsultant(caseId: string): Promise<boolean> {
  if (!(await getBoolSetting("consultants.auto_assign_enabled", false))) return false;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c?.userId) return false;

  // Don't stack proposals: skip if the user already has an open assignment.
  const existing = await db.consultantAssignment.count({
    where: { userId: c.userId, status: { in: ["proposed", "user_accepted", "active"] } },
  });
  if (existing > 0) return false;

  const candidate = await pickConsultantForCase(caseId);
  if (!candidate) return false;
  const reason = await generateAssignmentReason(caseId, candidate);

  await db.consultantAssignment.create({
    data: {
      userId: c.userId,
      consultantId: candidate.userId,
      caseId,
      note: reason.summary,
      reasonSummary: reason.summary,
      reasonDetail: reason.detail,
      autoAssigned: true,
      assignedById: "auto",
    },
  });
  await db.notification.create({
    data: {
      userId: c.userId,
      kind: "assignment",
      title: "We found a consultant who fits your case",
      body: reason.summary,
      link: "/app/consultants",
    },
  });
  await db.notification.create({
    data: {
      userId: candidate.userId,
      kind: "assignment",
      title: "You've been matched with a client",
      body: reason.summary,
      link: "/consultant",
    },
  });
  const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        kind: "assignment",
        title: "Auto-assignment proposed",
        body: `${candidate.name} was auto-matched to case "${c.title.slice(0, 60)}". You can override it on the Assignments page.`,
        link: "/admin/assignments",
      },
    });
  }
  return true;
}
