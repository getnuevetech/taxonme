import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { AgencyUpdateForm, SyncIrsButton, ToggleAgencyUpdateButton } from "@/components/admin/agency-update-forms";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "IRS updates" };

export default async function AdminUpdatesPage() {
  await guardAdminPage("admin.content");
  const [updates, lastSync, lastStatus] = await Promise.all([
    db.agencyUpdate.findMany({ orderBy: { publishedAt: "desc" }, take: 100 }),
    getSetting("irs.last_sync_at", ""),
    getSetting("irs.last_sync_status", ""),
  ]);

  return (
    <div>
      <PageHeader
        title="IRS updates"
        subtitle="Pull official IRS news into the homepage and /irs-updates. Paid customers get case-impact analysis on each item."
      />

      <Card className="mb-8">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Live sync</h2>
            <p className="mt-1 text-xs text-slate-500">
              Last sync: {lastSync ? new Date(lastSync).toLocaleString("en-US") : "never"}
              {lastStatus ? ` · ${lastStatus}` : ""}
            </p>
            <p className="mt-2 max-w-2xl text-xs text-slate-500">
              Sync scrapes the IRS current-month newsroom plus the previous calendar month so the public list always
              covers the current and previous week. Optional RSS lives under App settings → irs.
            </p>
          </div>
          <SyncIrsButton />
        </CardBody>
      </Card>

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add an update manually</h2>
          <AgencyUpdateForm update={null} />
        </CardBody>
      </Card>

      <div className="space-y-4">
        {updates.map((u) => (
          <Card key={u.id}>
            <CardBody>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{u.title}</h3>
                <Badge color={u.isPublished ? "green" : "slate"}>{u.isPublished ? "published" : "draft"}</Badge>
                <Badge>{u.sourceAgency}</Badge>
                <span className="text-xs text-slate-400">{u.publishedAt.toLocaleDateString("en-US")}</span>
                <ToggleAgencyUpdateButton id={u.id} isPublished={u.isPublished} />
              </div>
              <AgencyUpdateForm
                update={{
                  id: u.id,
                  title: u.title,
                  summary: u.summary,
                  body: u.body,
                  sourceUrl: u.sourceUrl,
                  sourceAgency: u.sourceAgency,
                  isPublished: u.isPublished,
                }}
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
