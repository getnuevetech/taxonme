import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { SettingsForm, AddSettingForm } from "@/components/admin/settings-form";

export const metadata = { title: "App settings" };

export default async function AdminSettingsPage() {
  await guardAdminPage("admin.settings");
  const settings = await db.setting.findMany({
    where: { key: { not: "auth.secret" } },
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  const groups = Array.from(new Set(settings.map((s) => s.group)));

  return (
    <div>
      <PageHeader
        title="App settings"
        subtitle="Every variable the app uses — branding, URLs, OAuth keys, analysis parameters — lives here. Nothing is hardcoded."
      />
      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group}>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{group}</h2>
              <SettingsForm
                settings={settings
                  .filter((s) => s.group === group)
                  .map((s) => ({ key: s.key, value: s.value, label: s.label || s.key, type: s.type, description: s.description }))}
              />
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Add a custom setting</h2>
            <AddSettingForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
