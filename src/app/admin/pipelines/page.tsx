import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PipelineStepForm } from "@/components/admin/pipeline-step-form";
import { deletePipelineStepAction, toggleStageAction } from "@/actions/admin";

export const metadata = { title: "AI pipelines" };

export default async function PipelinesPage() {
  await guardAdminPage("admin.pipelines");
  const [stages, providers] = await Promise.all([
    db.pipelineStage.findMany({
      include: { steps: { orderBy: { sortOrder: "asc" }, include: { provider: true } } },
    }),
    db.aiProvider.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const order = ["summary", "goal", "document", "situation", "presenter", "qa", "notice", "letter"];
  stages.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div>
      <PageHeader
        title="AI pipelines"
        subtitle="Assign 2–3 AI models to each analysis stage, each with its own responsibility and prompt. Results are merged by the consensus engine; users only ever see the final result."
      />
      <div className="space-y-8">
        {stages.map((stage) => (
          <Card key={stage.key}>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{stage.name}</h2>
                  <p className="text-sm text-slate-500">{stage.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={stage.isEnabled ? "green" : "slate"}>{stage.isEnabled ? "enabled" : "disabled"}</Badge>
                  <form action={toggleStageAction.bind(null, stage.key, !stage.isEnabled)}>
                    <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {stage.isEnabled ? "Disable stage" : "Enable stage"}
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {stage.steps.map((step) => (
                  <details key={step.id} className="rounded-xl border border-slate-200">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm">
                      <span className="font-semibold text-slate-800">#{step.sortOrder}</span>
                      <Badge color="indigo">{step.role.replace(/_/g, " ")}</Badge>
                      <span className="text-slate-600">{step.provider.name}</span>
                      {!step.isEnabled && <Badge>disabled</Badge>}
                    </summary>
                    <div className="border-t border-slate-100 p-4">
                      <PipelineStepForm
                        stageKey={stage.key}
                        providers={providers}
                        step={{
                          id: step.id,
                          providerId: step.providerId,
                          role: step.role,
                          promptTemplate: step.promptTemplate,
                          sortOrder: step.sortOrder,
                          isEnabled: step.isEnabled,
                        }}
                      />
                      <form action={deletePipelineStepAction.bind(null, step.id)} className="mt-2 text-right">
                        <button className="text-xs font-medium text-red-500 hover:text-red-700">Remove step</button>
                      </form>
                    </div>
                  </details>
                ))}
                <details className="rounded-xl border border-dashed border-slate-300">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-600">+ Add a model to this stage</summary>
                  <div className="border-t border-slate-100 p-4">
                    <PipelineStepForm stageKey={stage.key} providers={providers} step={null} />
                  </div>
                </details>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
