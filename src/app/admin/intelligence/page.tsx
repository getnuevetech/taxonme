import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { IntelligenceDiagnosticsPanel } from "@/components/admin/intelligence-diagnostics-panel";
import { IntelligenceReenrichButton } from "@/components/admin/intelligence-reenrich-button";
import { IntelligenceBackfillPanel } from "@/components/admin/intelligence-backfill-panel";
import { SituationQaIntelligenceBackfillPanel } from "@/components/admin/situation-qa-intelligence-backfill-panel";
import { IntelligenceForceReenrichPanel } from "@/components/admin/intelligence-force-reenrich-panel";
import { lookupIntelligenceDiagnostics } from "@/lib/admin/intelligence-lookup";

export const metadata = { title: "Conversation intelligence" };

export default async function AdminIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await guardAdminPage("admin.ai");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const result = query ? await lookupIntelligenceDiagnostics(query) : null;

  return (
    <div>
      <PageHeader
        title="Conversation intelligence"
        subtitle="Pipeline A/B routing snapshots for Situation, Q&A thread, or Case ids. Cases use Case.intelligenceJson first, then linked Situation. Lookup is read-only; use Re-enrich, empty-entity backfill, or force overwrite to persist Package I enrichment."
      />

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="min-w-[16rem] flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Situation id / SIT-number · QaThread id · Case id
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="e.g. SIT-12 or clxyz…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Look up
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Cases without an origin Situation recompute from narrative (source marked recomputed). Does not replace{" "}
            <a href="/admin/diagnostics" className="text-indigo-600 hover:underline">
              AI ops Diagnostics
            </a>
            .
          </p>
        </CardBody>
      </Card>

      <div className="mt-6 space-y-4">
        <IntelligenceBackfillPanel />
        <SituationQaIntelligenceBackfillPanel />
        <IntelligenceForceReenrichPanel />
      </div>

      <div className="mt-6">
        {!query ? (
          <p className="text-sm text-slate-500">Enter an id to inspect the stored ConversationIntelligence snapshot.</p>
        ) : result == null ? (
          <p className="text-sm text-slate-500">No result.</p>
        ) : "error" in result ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {result.error}
          </div>
        ) : (
          <div className="space-y-4">
            <IntelligenceReenrichButton kind={result.kind} id={result.id} />
            <IntelligenceDiagnosticsPanel
              summary={result.summary}
              title={result.label}
              rawJson={result.rawJson}
            />
          </div>
        )}
      </div>
    </div>
  );
}
