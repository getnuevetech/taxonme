import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { checkAiV3Readiness } from "@/lib/ai/readiness";

export const metadata = { title: "AI readiness" };

export default async function AiReadinessPage() {
  await guardAdminPage("admin.ai");
  const readiness = await checkAiV3Readiness();
  const metrics = Object.entries(readiness.metrics);

  return (
    <div>
      <PageHeader
        title="AI readiness"
        subtitle="Runtime checks for prompt registry, pipeline steps, approved providers, source coverage, human review, and queued re-analysis."
      />
      <div className="space-y-6">
        <Card>
          <CardBody>
            <div className="flex items-center gap-2">
              <Badge color={readiness.ok ? "green" : "red"}>{readiness.ok ? "ready" : "blocked"}</Badge>
              <p className="text-sm text-slate-600">
                {readiness.ok ? "No blocking configuration errors found." : `${readiness.errors.length} blocking issue(s) must be fixed.`}
              </p>
            </div>
          </CardBody>
        </Card>

        {readiness.errors.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="font-semibold text-red-700">Blocking errors</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
                {readiness.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </CardBody>
          </Card>
        )}

        {readiness.warnings.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="font-semibold text-amber-700">Warnings</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {readiness.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h2 className="font-semibold text-slate-900">Metrics</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{key.replace(/([A-Z])/g, " $1")}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
