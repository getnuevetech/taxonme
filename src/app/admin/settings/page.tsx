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
  const appUrl = (settings.find((s) => s.key === "app.url")?.value ?? "http://localhost:3000").replace(/\/$/, "");
  const googleConfigured = !!settings.find((s) => s.key === "auth.google_client_id")?.value;

  return (
    <div>
      <PageHeader
        title="App settings"
        subtitle="Every variable the app uses — branding, URLs, OAuth keys, analysis parameters — lives here. Nothing is hardcoded."
      />

      <Card className="mb-6 border-indigo-200">
        <CardBody>
          <h2 className="text-sm font-semibold text-slate-900">
            Google sign-in setup {googleConfigured ? "· configured" : "· not configured"}
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>
              In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline">Google Cloud Console → APIs &amp; Services → Credentials</a>,
              create an <strong>OAuth client ID</strong> (type: Web application).
            </li>
            <li>
              Add this <strong>Authorized JavaScript origin</strong>:
              <code className="ml-1 select-all rounded bg-slate-900 px-2 py-0.5 font-mono text-emerald-300">{appUrl}</code>
            </li>
            <li>
              Add this <strong>Authorized redirect URI</strong>:
              <code className="ml-1 select-all rounded bg-slate-900 px-2 py-0.5 font-mono text-emerald-300">{appUrl}/api/auth/google/callback</code>
            </li>
            <li>
              Paste the generated <strong>Client ID</strong> and <strong>Client secret</strong> into the auth settings below and save —
              the &ldquo;Continue with Google&rdquo; button appears automatically once the Client ID is set.
            </li>
          </ol>
          {appUrl.includes("localhost") && (
            <p className="mt-2 text-xs text-amber-600">
              Your App URL is currently {appUrl} — Google allows localhost origins for testing, but remember to add your real
              domain to Google and update the App URL setting when you deploy.
            </p>
          )}
        </CardBody>
      </Card>
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
