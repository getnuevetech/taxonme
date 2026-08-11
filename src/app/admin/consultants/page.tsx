import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PeopleTabs } from "@/components/admin/people-tabs";
import { ConfirmForm } from "@/components/confirm-form";
import { ResetLinkButton } from "@/components/admin/reset-link-button";
import { reviewConsultantAction, setConsultantAccountStatusAction, deleteConsultantAccountAction } from "@/actions/admin";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

export const metadata = { title: "CPA / Consultants" };

export default async function AdminConsultantsPage() {
  await guardAdminPage("admin.consultants");
  const accounts = await db.user.findMany({
    where: { role: "consultant", status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    include: {
      consultantProfile: true,
      _count: { select: { consultantAssignments: true } },
    },
  });
  const pendingApplications = accounts.filter((a) => a.consultantProfile?.status === "pending");
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  const credentialBadge = (p: (typeof accounts)[number]["consultantProfile"]) => {
    if (!p) return <Badge color="slate">onboarding not submitted</Badge>;
    const color = p.status === "approved" ? "green" : p.status === "rejected" ? "red" : p.status === "suspended" ? "red" : "amber";
    return <Badge color={color}>{p.status}{p.autoApproved ? " (auto)" : ""}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="CPA / Consultants"
        subtitle="Partner professionals — their accounts, credentials, and approvals live here, separate from customers."
      />
      <PeopleTabs active="consultants" />

      {/* Approval queue first: this is the section that needs admin action. */}
      {pendingApplications.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Awaiting review ({pendingApplications.length})
          </h2>
          <div className="space-y-4">
            {pendingApplications.map((a) => {
              const p = a.consultantProfile!;
              const specialties: string[] = JSON.parse(p.specialties || "[]");
              return (
                <Card key={p.id} className="border-amber-300">
                  <CardBody>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {a.firstName} {a.lastName} <span className="font-normal text-slate-400">· {a.email}</span>
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
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {p.proofDocumentPath ? (
                            <a href={`/api/admin/files/${p.proofDocumentPath}`} target="_blank" className="font-medium text-indigo-600 underline">
                              Credential proof ↗
                            </a>
                          ) : (
                            <span className="text-amber-600">No credential proof</span>
                          )}
                          {p.photoIdPath ? (
                            <a href={`/api/admin/files/${p.photoIdPath}`} target="_blank" className="font-medium text-indigo-600 underline">
                              Photo ID ↗
                            </a>
                          ) : (
                            <span className="text-slate-400">No photo ID</span>
                          )}
                          {p.insurancePath ? (
                            <a href={`/api/admin/files/${p.insurancePath}`} target="_blank" className="font-medium text-indigo-600 underline">
                              E&amp;O insurance ↗
                            </a>
                          ) : (
                            <span className="text-slate-400">No insurance proof</span>
                          )}
                          <span className={p.attestedCompliance ? "text-emerald-600" : "text-amber-600"}>
                            {p.attestedCompliance ? "Compliance attested ✓" : "No compliance attestation"}
                          </span>
                        </div>
                      </div>
                    </div>
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
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">All consultant accounts</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Consultant</th>
              <th className="px-4 py-3">Credential</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Credential status</th>
              <th className="px-4 py-3">Clients</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No consultant accounts yet.</td></tr>
            )}
            {accounts.map((a) => {
              const p = a.consultantProfile;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${a.id}`} className="font-medium text-indigo-600 underline">
                      {`${a.firstName} ${a.lastName}`.trim() || a.email}
                    </Link>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p ? `${p.credentialType.toUpperCase().replace("_", " ")}${p.credentialNumber ? ` #${p.credentialNumber}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p?.isBusiness ? p.businessName || "Business" : "Individual"}</td>
                  <td className="px-4 py-3">{credentialBadge(p)}</td>
                  <td className="px-4 py-3 text-slate-600">{a._count.consultantAssignments}</td>
                  <td className="px-4 py-3">
                    <Badge color={a.status === "active" ? "green" : "red"}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-start justify-end gap-3 text-xs font-medium">
                      <ResetLinkButton userId={a.id} />
                      <form action={setConsultantAccountStatusAction.bind(null, a.id, a.status === "active" ? "suspended" : "active")}>
                        <button className="text-amber-600 hover:text-amber-800">
                          {a.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      </form>
                      <ConfirmForm
                        action={deleteConsultantAccountAction.bind(null, a.id)}
                        message={`Delete consultant ${a.email}? The account moves to Deleted accounts and is expunged automatically after the retention period.`}
                      >
                        <button className="text-red-500 hover:text-red-700">Delete</button>
                      </ConfirmForm>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Automated approval rules live under{" "}
        <Link href="/admin/consultant-approval" className="text-indigo-600 underline">CPA auto-approval</Link>. Assign
        approved consultants to customers from the{" "}
        <Link href="/admin/assignments" className="text-indigo-600 underline">Assignments</Link> page — connections
        require both parties&apos; consent.
      </p>
    </div>
  );
}
