import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { reviewConsultantAction } from "@/actions/admin";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";
import { AutoApproveSettings } from "@/components/admin/auto-approve-settings";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Consultants" };

export default async function AdminConsultantsPage() {
  await guardAdminPage("admin.consultants");
  const profiles = await db.consultantProfile.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: true },
  });
  const [autoEnabled, minYears] = await Promise.all([
    getSetting("consultants.auto_approve_enabled", "false"),
    getSetting("consultants.auto_approve_min_years", "3"),
  ]);
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Consultants"
        subtitle="Approve applications manually, or enable automated approval for fully-credentialed CPA/EA applicants."
      />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Automated approval</h2>
          <AutoApproveSettings enabled={autoEnabled === "true"} minYears={Number(minYears) || 3} />
        </CardBody>
      </Card>

      <div className="space-y-4">
        {profiles.length === 0 && <p className="text-sm text-slate-400">No consultant applications yet.</p>}
        {profiles.map((p) => {
          const specialties: string[] = JSON.parse(p.specialties || "[]");
          return (
            <Card key={p.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {p.user.firstName} {p.user.lastName} <span className="font-normal text-slate-400">· {p.user.email}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {p.credentialType.toUpperCase().replace("_", " ")}
                      {p.credentialNumber && ` · #${p.credentialNumber}`}
                      {p.ptin && ` · PTIN ${p.ptin}`}
                      {` · ${p.yearsExperience} yrs`}
                      {p.isBusiness && p.businessName && ` · ${p.businessName}${p.ein ? ` (EIN ${p.ein})` : ""}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {specialties.map((s) => <Badge key={s} color="indigo">{specialtyName(s)}</Badge>)}
                      {p.statesServed && <Badge>States: {p.statesServed}</Badge>}
                    </div>
                    {p.proofDocumentPath ? (
                      <p className="mt-2 text-xs text-emerald-600">Credential proof uploaded ✓</p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-600">No credential proof uploaded</p>
                    )}
                  </div>
                  <Badge color={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>
                    {p.status}{p.autoApproved ? " (auto)" : ""}
                  </Badge>
                </div>
                {p.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <form action={reviewConsultantAction.bind(null, p.id, true, "")}>
                      <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                        Approve
                      </button>
                    </form>
                    <form action={reviewConsultantAction.bind(null, p.id, false, "Application did not meet our requirements.")}>
                      <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
                {p.status === "approved" && (
                  <p className="mt-3 text-sm text-slate-500">
                    Assign clients from the <Link href="/admin/assignments" className="text-indigo-600 underline">Assignments</Link> page.
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
