import "server-only";
import { db } from "./db";
import { hasFeature, getActivePlan } from "./access";
import { FEATURE_KEYS, STAGE_KEYS } from "./constants";
import { callProvider } from "./ai/adapters";

// The in-account guide chatbot. It always analyzes the user's account state,
// coaches them through the current step of their case, and routes anything it
// can't help with to the FAQ or the ticketing system. It never intakes a new
// case in chat — it hands off to the real case flow with the user's consent.

export type GuideAction = {
  type: "new_case" | "ticket_tech" | "ticket_service" | "link" | "upgrade";
  label: string;
  href: string;
};

export type GuideReply = { message: string; actions: GuideAction[] };

// Practical, deterministic how-to knowledge for each verifiable step.
const STEP_TIPS: Record<string, string> = {
  GET_TRANSCRIPT:
    "Fastest way to get your IRS transcript: sign in (or sign up) at irs.gov/your-account — your Account Transcript is available instantly as a PDF. Choose the tax year in question, download it, and upload it to your case documents here. If you can't verify online, 'Get Transcript by Mail' takes about 10 days, or Form 4506-T (we have a guided version under IRS forms).",
  GET_ACCOUNT_TRANSCRIPT:
    "Fastest way to get your IRS transcript: sign in (or sign up) at irs.gov/your-account — your Account Transcript is available instantly as a PDF. Download it and upload it to your case documents here.",
  UPLOAD_DOCUMENTS:
    "Add your IRS notices, tax return, and any W-2/1099s to your case. Photos from your phone work fine. The more you add, the more precisely we can verify amounts.",
  REVIEW_ANALYSIS:
    "You've added documents — now hit 'Re-run analysis' on your case page so every amount gets verified against them.",
  DRAFT_LETTER:
    "Use Response letters → New letter. Describe what you want to say in plain English; we draft a professional letter you can edit and print. Mail it before your deadline (certified mail with return receipt is safest).",
  COMPLETE_FORM_9465:
    "Open IRS forms → Form 9465 and answer the quiz-style questions. Tip: your total balance divided by 72 is the minimum monthly payment the IRS usually accepts, and direct debit has the lowest setup fee.",
};

type Snapshot = {
  text: string;
  currentStep: { title: string; actionKey: string; caseId: string } | null;
  planName: string;
};

export async function buildAccountSnapshot(userId: string): Promise<Snapshot> {
  const [user, cases, deadlines, plan] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
    db.case.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        issues: { where: { state: { not: "resolved" } } },
        pathSteps: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.deadline.findMany({
      where: { userId, status: "open", dueDate: { gte: new Date() } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    getActivePlan(userId),
  ]);

  const lines: string[] = [`User first name: ${user?.firstName || "there"}`, `Plan: ${plan?.name ?? "Free"}`];
  let currentStep: Snapshot["currentStep"] = null;
  for (const c of cases) {
    const current = c.pathSteps.find((s) => s.status === "current");
    const done = c.pathSteps.filter((s) => s.status === "done").length;
    lines.push(
      `Case "${c.title.slice(0, 60)}": status ${c.status}, readiness ${c.readinessScore}%, ${c.issues.length} open issue(s), step ${done + 1}/${c.pathSteps.length}${current ? ` — current step: "${current.title}" (${current.actionKey || "manual"})` : ""}`,
    );
    if (!currentStep && current) currentStep = { title: current.title, actionKey: current.actionKey, caseId: c.id };
  }
  if (cases.length === 0) lines.push("No cases yet — the user hasn't started a case.");
  for (const d of deadlines) {
    lines.push(`Deadline: "${d.title}" due ${d.dueDate.toLocaleDateString("en-US")}`);
  }
  return { text: lines.join("\n"), currentStep, planName: plan?.name ?? "Free" };
}

function detectIntent(question: string): "new_case" | "tech" | "service" | null {
  const q = question.toLowerCase();
  if (/(new (case|situation|problem|issue)|another (case|problem|letter)|also got|just received|different (year|issue)|open a case|start a case)/.test(q)) return "new_case";
  if (/(bug|error|broken|crash|can'?t (log|sign) ?in|password|upload(ing)? (fail|isn|not)|page (won'?t|not) load|payment failed|charge[d]? twice|site .*(slow|down)|glitch)/.test(q)) return "tech";
  if (/(refund me|cancel (my )?subscription|billing (problem|issue)|complain|speak (to|with) (someone|human|agent|person)|customer service|talk to a human)/.test(q)) return "service";
  return null;
}

function baseActions(): GuideAction[] {
  return [
    { type: "link", label: "Browse the FAQ", href: "/p/faq" },
    { type: "ticket_service", label: "Create a support ticket", href: "/app/support/new?category=customer_service" },
  ];
}

export async function guideRespond(
  userId: string,
  history: { role: string; content: string }[],
): Promise<GuideReply> {
  const snapshot = await buildAccountSnapshot(userId);
  const lastQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  // Paid-feature gate: free accounts get a friendly upsell instead of coaching.
  if (!(await hasFeature(userId, FEATURE_KEYS.GUIDE_CHATBOT))) {
    return {
      message:
        `Hi! I'm your personal case guide — I watch your case, tell you exactly what to do next, and answer questions along the way. The guide is part of our paid plans, and honestly it's the fastest way to get your tax situation resolved. You're currently on the ${snapshot.planName} plan — upgrade to unlock me, and I'll walk you through every step.`,
      actions: [
        { type: "upgrade", label: "See plans & upgrade", href: "/app/billing" },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    };
  }

  // Opening message (no user question yet): proactive account analysis.
  if (!lastQuestion) {
    const tip = snapshot.currentStep
      ? STEP_TIPS[snapshot.currentStep.actionKey.toUpperCase()] ??
        `Your next step is "${snapshot.currentStep.title}". Knock it out and you're one step closer — I'm here if you need help with it.`
      : "You haven't started a case yet — tell us what's going on with your taxes and we'll break it into simple steps.";
    return {
      message: `Here's where you stand:\n\n${snapshot.text
        .split("\n")
        .filter((l) => l.startsWith("Case") || l.startsWith("Deadline") || l.startsWith("No cases"))
        .join("\n")}\n\nNext up: ${tip}\n\nYou're making progress — stick with the plan and ask me anything about your next step.`,
      actions: snapshot.currentStep
        ? [{ type: "link", label: "Open my case", href: `/app/cases/${snapshot.currentStep.caseId}` }, ...baseActions()]
        : [{ type: "link", label: "Start my first case", href: "/app/cases/new" }, ...baseActions()],
    };
  }

  // Hard routing rules the AI must not override.
  const intent = detectIntent(lastQuestion);
  if (intent === "new_case") {
    return {
      message:
        "That sounds like a separate tax situation — it deserves its own case so it gets a full analysis, its own issues, and its own step-by-step plan (chat isn't the right place to handle it). Want me to start it as a new case? Your message will be pre-filled and you just confirm.",
      actions: [
        { type: "new_case", label: "Yes — start this as a new case", href: `/app/cases/new?prefill=${encodeURIComponent(lastQuestion.slice(0, 500))}` },
        ...baseActions(),
      ],
    };
  }
  if (intent === "tech") {
    return {
      message:
        "That sounds like a technical issue — I'll route you to our tech support team so it gets fixed properly. I've prepared a tech support ticket with your description; just review and submit it, and the team will follow up.",
      actions: [
        { type: "ticket_tech", label: "Create tech support ticket", href: `/app/support/new?category=tech_support&subject=${encodeURIComponent(lastQuestion.slice(0, 120))}` },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    };
  }
  if (intent === "service") {
    return {
      message:
        "I want to make sure a human takes care of this for you. Let's create a customer service ticket — an agent will pick it up and follow up with you directly. Your message will be pre-filled.",
      actions: [
        { type: "ticket_service", label: "Create customer service ticket", href: `/app/support/new?category=customer_service&subject=${encodeURIComponent(lastQuestion.slice(0, 120))}` },
        { type: "link", label: "Browse the FAQ", href: "/p/faq" },
      ],
    };
  }

  // AI coaching: try each configured model in order (up to all five) until one answers.
  const stage = await db.pipelineStage.findUnique({
    where: { key: STAGE_KEYS.GUIDE },
    include: {
      steps: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" }, include: { provider: true } },
    },
  });
  const steps = (stage?.isEnabled ? stage.steps : []).filter((s) => s.provider.isEnabled && s.provider.apiKey);
  const convo = history.map((m) => `${m.role === "user" ? "User" : "Guide"}: ${m.content}`).join("\n");
  for (const step of steps) {
    try {
      const prompt = step.promptTemplate.replace("{{context}}", snapshot.text).replace("{{input}}", convo);
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) {
        return { message: result.text.trim(), actions: baseActions() };
      }
    } catch (err) {
      const { logSystem } = await import("./syslog");
      await logSystem("error", "guide", `${step.provider.name} failed answering the guide chat`, String(err), userId);
      // fall through to the next configured model
    }
  }

  // Deterministic fallback when no AI is reachable: coach the current step.
  const tip = snapshot.currentStep
    ? STEP_TIPS[snapshot.currentStep.actionKey.toUpperCase()] ??
      `Your current step is "${snapshot.currentStep.title}" — open your case and it will tell you exactly what completes it.`
    : "Start by creating a case — describe what happened and your goal, and we'll build your step-by-step plan.";
  return {
    message: `Here's what I can tell you right now: ${tip}\n\nIf that doesn't answer your question, the FAQ covers the most common ones, or I can connect you with our customer service team.`,
    actions: snapshot.currentStep
      ? [{ type: "link", label: "Open my case", href: `/app/cases/${snapshot.currentStep.caseId}` }, ...baseActions()]
      : [{ type: "link", label: "Start a case", href: "/app/cases/new" }, ...baseActions()],
  };
}
