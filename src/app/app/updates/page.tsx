import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { listPublishedUpdates } from "@/lib/agency-updates/sync";
import { userCanSeeCaseImpact } from "@/lib/agency-updates/impact";
import { getSetting } from "@/lib/settings";
import { SETTINGS } from "@/lib/constants";

export const metadata = { title: "USCIS updates" };

export default async function AppUpdatesPage() {
  const user = await requireUser();
  const [agency, updates, entitled] = await Promise.all([
    getSetting(SETTINGS.USCIS_AGENCY_LABEL, "USCIS"),
    listPublishedUpdates(40),
    userCanSeeCaseImpact(user.id),
  ]);

  return (
    <div>
      <PageHeader
        title={`${agency} updates`}
        subtitle={
          entitled
            ? "Open an update to see how it may affect each of your cases."
            : "Browse official updates. Upgrade to Plus or Pro for personalized case-impact analysis."
        }
      />
      {!entitled && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Personalized impact analysis is included with Plus and Pro.{" "}
          <Link href="/app/billing?upgrade=updates" className="font-semibold underline">
            Upgrade your plan
          </Link>
        </div>
      )}
      {updates.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">No published updates yet. Check back after the next sync.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <Card key={u.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/updates/${u.slug}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                    {u.title}
                  </Link>
                  {u.summary && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{u.summary}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    {u.publishedAt.toLocaleDateString("en-US")} · {u.sourceAgency}
                  </p>
                </div>
                <Badge color={entitled ? "indigo" : "slate"}>{entitled ? "Case impact available" : "General update"}</Badge>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
