import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";

export const metadata = { title: "Source snapshots" };

export default async function SourceSnapshotsPage() {
  await guardAdminPage("admin.knowledge");
  const snapshots = await db.sourceSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div>
      <PageHeader
        title="Source snapshots"
        subtitle="Immutable fingerprints of authoritative source context used by v3 AI runs, with source references and tax-year metadata."
      />
      <Card>
        <CardBody>
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500">No source snapshots have been recorded yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Hash</th>
                  <th className="py-2 pr-4">Sources</th>
                  <th className="py-2 pr-4">Tax years</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => {
                  const refs = JSON.parse(snapshot.sourceRefsJson || "[]") as string[];
                  const years = JSON.parse(snapshot.taxYearsJson || "[]") as string[];
                  return (
                    <tr key={snapshot.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-mono text-xs">{snapshot.snapshotHash.slice(0, 24)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {refs.length ? refs.map((ref) => <Badge key={ref}>{ref}</Badge>) : <span className="text-slate-400">none parsed</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {years.length ? years.map((year) => <Badge key={year} color="blue">{year}</Badge>) : <span className="text-slate-400">n/a</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{snapshot.createdAt.toLocaleString("en-US")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
