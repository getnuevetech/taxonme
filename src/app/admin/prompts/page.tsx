import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { toggleAiPromptAction } from "@/actions/admin";

export const metadata = { title: "AI prompts" };

export default async function AiPromptsPage() {
  await guardAdminPage("admin.pipelines");
  const prompts = await db.aiPrompt.findMany({
    orderBy: [{ kind: "asc" }, { stageKey: "asc" }, { responsibility: "asc" }, { promptId: "asc" }],
    include: { changes: { orderBy: { createdAt: "desc" }, take: 3 } },
  });

  return (
    <div>
      <PageHeader
        title="AI prompts"
        subtitle="Released v3 global rules, responsibility prompts, pipeline overlays, and schemas. Released prompt bodies are immutable; new versions should be activated by configuration."
      />
      <div className="space-y-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id}>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-sm font-semibold text-slate-900">{prompt.promptId}</h2>
                    <Badge color={prompt.isActive ? "green" : "slate"}>{prompt.isActive ? "active" : "inactive"}</Badge>
                    <Badge>{prompt.kind}</Badge>
                    {prompt.stageKey && <Badge color="blue">{prompt.stageKey}</Badge>}
                    {prompt.responsibility && <Badge color="indigo">{prompt.responsibility}</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{prompt.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    version {prompt.version}; schema {prompt.schemaVersion}; hash {prompt.bodyHash || "pending seed"}; released {prompt.releasedAt?.toLocaleString("en-US") ?? "n/a"}
                  </p>
                </div>
                <form action={toggleAiPromptAction.bind(null, prompt.id, !prompt.isActive)}>
                  <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    {prompt.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
              <details className="mt-3 rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">View prompt body</summary>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-slate-100 p-3 text-xs text-slate-700">{prompt.body}</pre>
              </details>
              {prompt.changes.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Recent protected-change attempts</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {prompt.changes.map((change) => (
                      <li key={change.id}>{change.createdAt.toLocaleString("en-US")}: {change.changeReason} ({change.fromHash.slice(0, 8)} -> {change.toHash.slice(0, 8)})</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
