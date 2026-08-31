import Link from "next/link";
import { buildPrepPlanContent } from "@/lib/prep-plan";
import { situationRefLabel } from "@/lib/situation";

function parseJsonArray<T>(raw: string): T[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends Record<string, unknown>>(raw: string): T {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? (v as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function PrepPlanWorkspaceView(props: {
  id: string;
  selectedPathway: string;
  eligibilityJson: string;
  blockersJson: string;
  filingsJson: string;
  evidenceNeedsJson: string;
  sequenceJson: string;
  preparationStatus: string;
  situation: { id: string; number: number; title: string };
  isGuest?: boolean;
}) {
  const fallback = buildPrepPlanContent({ selectedPathway: props.selectedPathway });
  const eligibility = parseJsonObject<{ summary?: string; requirements?: string[] }>(props.eligibilityJson);
  const blockers = parseJsonArray<string>(props.blockersJson);
  const filings = parseJsonArray<{ form: string; role: string; notes: string }>(props.filingsJson);
  const evidence = parseJsonArray<string>(props.evidenceNeedsJson);
  const sequence = parseJsonArray<string>(props.sequenceJson);

  const summary = eligibility.summary || fallback.eligibility.summary;
  const requirements = eligibility.requirements?.length
    ? eligibility.requirements
    : fallback.eligibility.requirements;
  const situationHref = props.isGuest
    ? `/start/situation?id=${props.situation.id}`
    : `/app/situations/${props.situation.id}`;

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium text-indigo-700">Prep Plan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{fallback.pathwayLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">
          From {situationRefLabel(props.situation.number)} · Status: {props.preparationStatus}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <Link href={situationHref} className="font-medium text-indigo-700 hover:underline">
            ← Back to your Situation
          </Link>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recommended pathway</h2>
        <p className="text-slate-800 leading-relaxed">{summary}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Eligibility to confirm</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          {requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Risks / blockers</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          {(blockers.length ? blockers : fallback.blockers).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Forms / filings</h2>
        <ul className="space-y-3">
          {(filings.length ? filings : fallback.filings).map((f) => (
            <li key={`${f.form}-${f.role}`} className="border-l-2 border-indigo-500 pl-3">
              <p className="font-medium text-slate-900">
                Form {f.form} — {f.role}
              </p>
              <p className="text-sm text-slate-600">{f.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documents needed</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          {(evidence.length ? evidence : fallback.evidenceNeeds).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Expected sequence</h2>
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          {(sequence.length ? sequence : fallback.sequence).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Next steps</h2>
        <p className="text-sm text-slate-700">{fallback.consultantHint}</p>
        <p className="text-sm text-slate-700">{fallback.selfFileHint}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/app/consultants"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Talk to a tax professional
          </Link>
          <Link
            href="/app/forms"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Prepare IRS forms
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          A Prep Plan is not a Case. Only an existing filed or agency matter should be tracked as Your IRS Case.
        </p>
      </section>
    </div>
  );
}
