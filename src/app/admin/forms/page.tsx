import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { FormTemplateForm } from "@/components/admin/form-template-form";
import { PaidDownloadsToggle } from "@/components/admin/paid-downloads-toggle";
import { FormPdfRefresh } from "@/components/admin/form-pdf-refresh";
import { deleteFormTemplateAction } from "@/actions/admin";
import { readUpload } from "@/lib/uploads";
import { listPdfFields } from "@/lib/pdf-forms";

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
        {await Promise.all(templates.map(async (t) => {
          // Detected fillable fields of the cached official PDF (for mapping).
          let pdfFields: { name: string; type: string }[] = [];
          if (t.pdfPath) {
            try {
              pdfFields = await listPdfFields(await readUpload(t.pdfPath));
            } catch { /* cached PDF unreadable — admin can refetch */ }
          }
          return (
          <Card key={t.id}>
            <CardBody>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">Form {t.formNumber} — {t.title}</span>
                  <Badge color={t.isPublished ? "green" : "red"}>{t.isPublished ? "published" : "draft"}</Badge>
                  {t.requiredFeature && <Badge color="amber">requires {t.requiredFeature}</Badge>}
                  <Badge color={t.pdfPath ? "green" : t.pdfSourceUrl ? "amber" : "slate"}>
                    {t.pdfPath ? "official PDF ✓" : t.pdfSourceUrl ? "PDF not fetched yet" : "no official PDF"}
                  </Badge>
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
                      pdfSourceUrl: t.pdfSourceUrl,
                      pdfMapJson: t.pdfMapJson,
                      isPublished: t.isPublished,
                      requiredFeature: t.requiredFeature,
                      sortOrder: t.sortOrder,
                    }}
                  />
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Official IRS PDF</p>
                        <p className="text-xs text-slate-500">
                          {t.pdfPath
                            ? `Cached and ready — customer downloads are generated from this PDF (${pdfFields.length} fillable fields).`
                            : t.pdfSourceUrl
                              ? "Not fetched yet — it downloads automatically on the first customer download, or fetch it now."
                              : "Set the official IRS PDF URL above and save, then fetch to see its fillable fields."}
                        </p>
                      </div>
                      <FormPdfRefresh templateId={t.id} />
                    </div>
                    {pdfFields.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-indigo-600">
                          Detected PDF fields ({pdfFields.length}) — use these names in the mapping
                        </summary>
                        <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto rounded-lg bg-white p-3 font-mono text-[11px] text-slate-600 ring-1 ring-slate-100">
                          {pdfFields.map((f) => (
                            <li key={f.name}>
                              <span className="text-slate-400">[{f.type}]</span> {f.name}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <form action={deleteFormTemplateAction.bind(null, t.id)} className="mt-2 text-right">
                    <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete template</button>
                  </form>
                </div>
              </details>
            </CardBody>
          </Card>
          );
        }))}
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
