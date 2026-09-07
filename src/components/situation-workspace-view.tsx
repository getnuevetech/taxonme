import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createPrepPlanAction } from "@/actions/prep-plan";
import { composeAssistantView, parseStoredIntelligence } from "@/lib/conversation";
import { AssistantReplyBlocks } from "@/components/assistant-reply";
import { situationRefLabel } from "@/lib/situation";
import { parsePathwaysJson } from "@/lib/prep-plan";

export function SituationWorkspaceView(props: {
  id: string;
  number: number;
  title: string;
  originalNarrative: string;
  goal: string;
  assistantReply: string;
  intelligenceJson: string;
  currentPathwaysJson: string;
  createdAt: Date;
  existingPrepPlanId?: string | null;
  isGuest?: boolean;
  canBuildPrepPlan?: boolean;
  prepPlanBlockedReason?: "upgrade" | "limit" | "guest" | null;
}) {
  const intel = parseStoredIntelligence(props.intelligenceJson);
  const sections =
    intel != null
      ? composeAssistantView(intel, props.originalNarrative)
      : [{ type: "paragraph" as const, text: props.assistantReply }];

  const asked =
    intel?.question_contract.explicit_question ||
    intel?.question_contract.interpreted_question ||
    props.goal ||
    "What are my options?";

  const pathways = parsePathwaysJson(props.currentPathwaysJson);
  const defaultPathway = pathways[0]?.id ?? "";

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium text-indigo-700">Your Tax Situation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{props.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {situationRefLabel(props.number)} · Opened {props.createdAt.toLocaleDateString("en-US")}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What you asked</h2>
        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{props.originalNarrative}</p>
        {props.goal ? <p className="text-sm text-slate-600">Goal: {props.goal}</p> : null}
        <p className="text-sm italic text-slate-500">{asked}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What this may mean</h2>
        <AssistantReplyBlocks sections={sections} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-800">When you&apos;re ready</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.existingPrepPlanId ? (
            <Link
              href={
                props.isGuest
                  ? `/start/prep-plan?id=${props.existingPrepPlanId}`
                  : `/app/prep-plans/${props.existingPrepPlanId}`
              }
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View my Prep Plan
            </Link>
          ) : props.canBuildPrepPlan === false || props.prepPlanBlockedReason ? (
            <Link
              href={
                props.prepPlanBlockedReason === "guest"
                  ? "/register?next=/app/billing"
                  : props.prepPlanBlockedReason === "limit"
                    ? "/app/billing?upgrade=prep_plan_limit"
                    : "/app/billing?upgrade=prep_plan"
              }
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {props.prepPlanBlockedReason === "guest"
                ? "Create an account to build a Prep Plan"
                : props.prepPlanBlockedReason === "limit"
                  ? "Upgrade to Pro for more Prep Plans"
                  : "Upgrade to Plus to build a Prep Plan"}
            </Link>
          ) : (
            <ActionForm action={createPrepPlanAction} className="inline">
              <input type="hidden" name="situationId" value={props.id} />
              <input type="hidden" name="selectedPathway" value={defaultPathway} />
              <SubmitButton className="rounded-lg px-3 py-2 text-sm">Build my Prep Plan</SubmitButton>
            </ActionForm>
          )}
          <Link
            href="/app/consultants"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Talk to a tax professional
          </Link>
          <Link
            href="/app/qa"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Ask another question
          </Link>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This is not an IRS Case. A Prep Plan prepares a path; a Case appears only when something is actually before the IRS or another tax agency.
        </p>
      </section>
    </div>
  );
}
