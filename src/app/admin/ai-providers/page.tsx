import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { AiProviderForm } from "@/components/admin/ai-provider-form";
import { deleteAiProviderAction } from "@/actions/admin";

export const metadata = { title: "AI providers" };

export default async function AiProvidersPage() {
  await guardAdminPage("admin.ai");
  const providers = await db.aiProvider.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="AI providers"
        subtitle="Connect 3–5 AI APIs here. Every variable — base URL, key, model, limits — is managed from this screen, never hardcoded."
      />
      <div className="space-y-6">
        {providers.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">{p.name}</h2>
                <Badge color={p.isEnabled && p.apiKey ? "green" : "slate"}>
                  {p.apiKey ? (p.isEnabled ? "connected" : "disabled") : "no API key"}
                </Badge>
                <Badge>{p.kind}</Badge>
              </div>
              <AiProviderForm
                provider={{
                  id: p.id,
                  name: p.name,
                  kind: p.kind,
                  baseUrl: p.baseUrl,
                  hasKey: p.apiKey.length > 0,
                  model: p.model,
                  maxTokens: p.maxTokens,
                  temperature: p.temperature,
                  supportsVision: p.supportsVision,
                  isEnabled: p.isEnabled,
                  notes: p.notes,
                }}
              />
              <form action={deleteAiProviderAction.bind(null, p.id)} className="mt-2 text-right">
                <button className="text-xs font-medium text-red-500 hover:text-red-700">Remove provider</button>
              </form>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Add a provider</h2>
            <AiProviderForm provider={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
