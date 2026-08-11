import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { FormTemplateForm } from "@/components/admin/form-template-form";
import { PaidDownloadsToggle } from "@/components/admin/paid-downloads-toggle";
import { deleteFormTemplateAction } from "@/actions/admin";

export const metadata = { title: "IRS form templates" };

export default async function AdminFormsPage() {
  await guardAdminPage("admin.forms");
  const { getBoolSetting } = await import("@/lib/settings");
  const [templates, features, paidDownloads] = await Promise.all([
    db.irsFormTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    db.featureDef.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    getBoolSetting("forms.paid_downloads", true),
  ]);

  return (
    <div>
      <PageHeader
        title="IRS form templates"
        subtitle="Define the simplified 'video-game' wizard for each IRS form, plus the output template that regenerates the completed standard form."
      />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Completed form downloads</h2>
          <p className="mb-3 text-xs text-slate-500">
            When paid, downloading a completed form requires a plan that includes the &ldquo;{features.find((f) => f.key === "forms.download")?.name ?? "form download"}&rdquo; feature
            (configure which plans under Plans &amp; access). When free, every user can download their completed forms.
          </p>
          <PaidDownloadsToggle paid={paidDownloads} />
        </CardBody>
      </Card>
      <div className="space-y-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardBody>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">Form {t.formNumber} — {t.title}</span>
                  <Badge color={t.isPublished ? "green" : "red"}>{t.isPublished ? "published" : "draft"}</Badge>
                  {t.requiredFeature && <Badge color="amber">requires {t.requiredFeature}</Badge>}
                </summary>
                <div className="mt-4">
                  <FormTemplateForm
                    features={features}
                    template={{
                      id: t.id,
                      formNumber: t.formNumber,
                      title: t.title,
                      description: t.description,
                      category: t.category,
                      stepsJson: t.stepsJson,
                      outputTemplate: t.outputTemplate,
                      isPublished: t.isPublished,
                      requiredFeature: t.requiredFeature,
                      sortOrder: t.sortOrder,
                    }}
                  />
                  <form action={deleteFormTemplateAction.bind(null, t.id)} className="mt-2 text-right">
                    <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete template</button>
                  </form>
                </div>
              </details>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Add a form template</h2>
            <FormTemplateForm features={features} template={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
