import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader } from "@/components/ui";
import { AiLab } from "@/components/admin/ai-lab";
import { LAB_FUNCTIONS } from "@/lib/ai/lab";

export const metadata = { title: "AI test lab" };

export default async function AiLabPage() {
  await guardAdminPage("admin.ai");
  const providers = await db.aiProvider.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="AI test lab"
        subtitle="Run the same question, documents, or images through several models at once — per platform function — and compare the outputs side by side to decide which model earns each pipeline role."
      />
      <AiLab
        providers={providers.map((p) => ({
          id: p.id,
          name: p.name,
          model: p.model,
          kind: p.kind,
          supportsVision: p.supportsVision,
          hasKey: p.apiKey.length > 0,
          isEnabled: p.isEnabled,
        }))}
        functions={LAB_FUNCTIONS.map((f) => ({ key: f.key, name: f.name, description: f.description }))}
      />
    </div>
  );
}
