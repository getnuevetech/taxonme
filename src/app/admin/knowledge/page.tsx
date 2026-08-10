import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { deleteKnowledgeAction } from "@/actions/admin";

export const metadata = { title: "IRS knowledge base" };

export default async function AdminKnowledgePage() {
  await guardAdminPage("admin.knowledge");
  const sources = await db.knowledgeSource.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="IRS knowledge base"
        subtitle="The authoritative reference material the AI analysis is grounded in: publications, form instructions, notice guides, transaction codes, and current announcements. Models cite this, not their memory."
      />
      <div className="space-y-4">
        {sources.map((s) => (
          <Card key={s.id}>
            <CardBody>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{s.title}</span>
                  <Badge color="indigo">{s.sourceType.replace(/_/g, " ")}</Badge>
                  {s.reference && <Badge>{s.reference}</Badge>}
                  {s.taxYear && <Badge>{s.taxYear}</Badge>}
                  <Badge color={s.isActive ? "green" : "red"}>{s.isActive ? "active" : "inactive"}</Badge>
                </summary>
                <div className="mt-4">
                  <KnowledgeForm
                    source={{ id: s.id, title: s.title, sourceType: s.sourceType, reference: s.reference, url: s.url, content: s.content, tags: s.tags, taxYear: s.taxYear, isActive: s.isActive }}
                  />
                  <form action={deleteKnowledgeAction.bind(null, s.id)} className="mt-2 text-right">
                    <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete source</button>
                  </form>
                </div>
              </details>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Add a source</h2>
            <KnowledgeForm source={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
