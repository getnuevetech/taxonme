import Link from "next/link";
import { analyzeUpdateImpactForCase, userCanSeeCaseImpact, type ImpactResult } from "@/lib/agency-updates/impact";
import { ButtonLink, Badge } from "@/components/ui";
import { AnalyzeUpdateImpactForm } from "@/components/analyze-update-impact-form";

function relevanceColor(relevance: ImpactResult["relevance"]): "green" | "amber" | "red" | "slate" | "indigo" {
  if (relevance === "high") return "red";
  if (relevance === "medium") return "amber";
  if (relevance === "low") return "indigo";
  if (relevance === "none") return "green";
  return "slate";
}

export async function CaseImpactPanel({
  userId,
  updateId,
  cases,
}: {
  userId: string;
  updateId: string;
  cases: { id: string; title: string }[];
}) {
  const entitled = await userCanSeeCaseImpact(userId);
  if (!entitled) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-5">
        <h2 className="text-base font-semibold text-indigo-950">How this update affects your case</h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-900/80">
          Plus and Pro customers get a plain-English read of whether this official update changes anything in their open case —
          relevance, what may have shifted, and suggested next steps.
        </p>
        <div className="mt-4">
          <ButtonLink href="/app/billing?upgrade=updates" className="rounded-full">
            Unlock case impact analysis →
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
        <h2 className="text-base font-semibold text-slate-900">How this update affects your case</h2>
        <p className="mt-2 text-sm text-slate-600">
          You don&apos;t have an open case yet. Start one and we can score this update against your situation.
        </p>
        <div className="mt-4">
          <ButtonLink href="/app/cases/new" variant="secondary" className="rounded-full">
            Start a case →
          </ButtonLink>
        </div>
      </div>
    );
  }

  const impacts = await Promise.all(
    cases.slice(0, 3).map(async (c) => ({
      case: c,
      impact: await analyzeUpdateImpactForCase({ userId, caseId: c.id, updateId }),
    })),
  );

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">How this update affects your case</h2>
          <p className="mt-1 text-sm text-slate-600">Personalized for your paid plan — based on your case evidence and this official update.</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {impacts.map(({ case: c, impact }) => (
          <div key={c.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/app/cases/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                {c.title}
              </Link>
              {impact && <Badge color={relevanceColor(impact.relevance)}>{impact.relevance} relevance</Badge>}
            </div>
            {impact ? (
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p>{impact.summary}</p>
                {impact.whatChanged && (
                  <p>
                    <span className="font-medium text-slate-900">What may have changed: </span>
                    {impact.whatChanged}
                  </p>
                )}
                {impact.recommendedActions.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-slate-600">
                    {impact.recommendedActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Impact analysis unavailable for this case.</p>
            )}
            <div className="mt-3">
              <AnalyzeUpdateImpactForm updateId={updateId} caseId={c.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
