import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { ContentPageForm } from "@/components/admin/content-form";
import { deleteContentPageAction } from "@/actions/admin";

export const metadata = { title: "Content & agreements" };

export default async function AdminContentPage() {
  await guardAdminPage("admin.content");
  const pages = await db.contentPage.findMany({ orderBy: [{ kind: "asc" }, { updatedAt: "desc" }] });

  return (
    <div>
      <PageHeader
        title="Content & agreements"
        subtitle="Publish terms, privacy, legal pages, blog posts, and the agreements each account type must sign. Bump the version when an agreement changes."
      />
      <div className="space-y-4">
        {pages.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.title}</span>
                  <Badge color="indigo">{p.kind.replace(/_/g, " ")}</Badge>
                  <Badge>v{p.version}</Badge>
                  <Badge>{p.audience}</Badge>
                  <Badge color={p.isPublished ? "green" : "red"}>{p.isPublished ? "published" : "draft"}</Badge>
                  <span className="text-xs text-slate-400">/p/{p.slug}</span>
                </summary>
                <div className="mt-4">
                  <ContentPageForm
                    page={{ id: p.id, slug: p.slug, title: p.title, body: p.body, kind: p.kind, audience: p.audience, isPublished: p.isPublished }}
                  />
                  <form action={deleteContentPageAction.bind(null, p.id)} className="mt-2 text-right">
                    <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete page</button>
                  </form>
                </div>
              </details>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Create a page</h2>
            <ContentPageForm page={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
