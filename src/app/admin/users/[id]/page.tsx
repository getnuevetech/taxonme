import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea, isAdmin } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, Money } from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { ResetLinkButton } from "@/components/admin/reset-link-button";
import { setUserStatusAction, adminDeleteUserAction, setConsultantAccountStatusAction, deleteConsultantAccountAction } from "@/actions/admin";
import { formatCaseNumber } from "@/lib/case-number";
import { formatTicketNumber, formatTransactionNumber } from "@/lib/ticket-number";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

// Full detail page for any customer or consultant account.
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (!isAdmin(admin)) redirect("/app");

  const user = await db.user.findUnique({
    where: { id },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 3, include: { plan: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 10, include: { plan: { select: { name: true } } } },
      cases: { orderBy: { updatedAt: "desc" }, include: { issues: { select: { id: true } } } },
      documents: { where: { deletedAt: null }, select: { id: true } },
      tickets: { orderBy: { updatedAt: "desc" }, take: 8 },
      agreementAcceptances: { include: { page: { select: { title: true } } }, orderBy: { acceptedAt: "desc" } },
      consultantProfile: { include: { pastCases: { orderBy: { createdAt: "desc" } } } },
      clientAssignments: { include: { consultant: { select: { firstName: true, lastName: true, email: true } } } },
      consultantAssignments: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
    },
  });
  if (!user || (user.role !== "user" && user.role !== "consultant")) notFound();

  const isConsultant = user.role === "consultant";
  const requiredArea = isConsultant ? "admin.consultants" : "admin.users";
  if (!hasAdminArea(admin, requiredArea)) redirect("/admin");

  const activeSub = user.subscriptions.find((s) => ["active", "trialing"].includes(s.status));
  const p = user.consultantProfile;
  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`.trim() || user.email}
        subtitle={`${isConsultant ? "CPA / Consultant" : "Customer"} · joined ${user.createdAt.toLocaleDateString("en-US")}`}
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <ResetLinkButton userId={user.id} />
            <form action={(isConsultant ? setConsultantAccountStatusAction : setUserStatusAction).bind(null, user.id, user.status === "active" ? "suspended" : "active")}>
              <button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                {user.status === "active" ? "Suspend" : "Reactivate"}
              </button>
            </form>
            <ConfirmForm
              action={(isConsultant ? deleteConsultantAccountAction : adminDeleteUserAction).bind(null, user.id)}
              message={`Delete ${user.email}? The account moves to Deleted accounts and is expunged after the retention period.`}
            >
              <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                Delete
              </button>
            </ConfirmForm>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Profile</h2>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt><dd className="text-slate-800">{user.email}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt><dd className="text-slate-800">{user.phone || "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">Address</dt><dd className="text-slate-800">{user.address || "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">ID number</dt><dd className="text-slate-800">{user.idNumber || "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">Bio</dt><dd className="text-slate-800">{user.bio || "—"}</dd></div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
                  <dd><Badge color={user.status === "active" ? "green" : "red"}>{user.status}</Badge></dd>
                </div>
                <div><dt className="text-xs uppercase tracking-wide text-slate-400">Sign-in method</dt><dd className="text-slate-800">{user.googleId ? "Google + password" : "Email & password"}</dd></div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Plan & billing</h2>
              <p className="text-sm text-slate-800">
                <Badge color={activeSub ? "indigo" : "slate"}>{activeSub?.plan.name ?? "Free / none"}</Badge>
                {activeSub?.currentPeriodEnd && (
                  <span className="ml-2 text-xs text-slate-500">renews {activeSub.currentPeriodEnd.toLocaleDateString("en-US")}</span>
                )}
              </p>
              <table className="mt-3 w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {user.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5 font-mono text-indigo-700">{formatTransactionNumber(t.number)}</td>
                      <td className="py-1.5"><Money cents={t.amountCents} /></td>
                      <td className="py-1.5 text-slate-500">{t.plan?.name ?? "—"}</td>
                      <td className="py-1.5 text-right"><Badge color={t.status === "succeeded" ? "green" : t.status === "pending" ? "amber" : "slate"}>{t.status}</Badge></td>
                    </tr>
                  ))}
                  {user.transactions.length === 0 && <tr><td className="py-2 text-slate-400">No transactions.</td></tr>}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Agreements accepted</h2>
              <ul className="space-y-1 text-xs text-slate-600">
                {user.agreementAcceptances.map((a) => (
                  <li key={a.id}>✓ {a.page.title} v{a.version} — {a.acceptedAt.toLocaleDateString("en-US")} ({a.context.replace(/_/g, " ")})</li>
                ))}
                {user.agreementAcceptances.length === 0 && <li className="text-slate-400">None recorded.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {isConsultant && p && (
            <Card>
              <CardBody>
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Credentials & practice</h2>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge color="indigo">{p.credentialType.toUpperCase().replace("_", " ")}</Badge>
                  {p.credentialNumber && <Badge>#{p.credentialNumber}{p.licenseState ? ` (${p.licenseState})` : ""}</Badge>}
                  {p.ptin && <Badge>PTIN {p.ptin}</Badge>}
                  {p.efin && <Badge>EFIN {p.efin}</Badge>}
                  <Badge color={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>{p.status}</Badge>
                  <Badge>{p.yearsExperience} yrs</Badge>
                  {p.isBusiness && <Badge>{p.businessName || "Business"}{p.ein ? ` · EIN ${p.ein}` : ""}</Badge>}
                </div>
                <p className="text-xs text-slate-500">
                  Specialties: {(JSON.parse(p.specialties || "[]") as string[]).map(specialtyName).join(", ") || "—"}
                  {p.statesServed && <> · States: {p.statesServed}</>}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {p.proofDocumentPath && <a href={`/api/admin/files/${p.proofDocumentPath}`} target="_blank" className="text-indigo-600 underline">Credential proof ↗</a>}
                  {p.photoIdPath && <a href={`/api/admin/files/${p.photoIdPath}`} target="_blank" className="text-indigo-600 underline">Photo ID ↗</a>}
                  {p.insurancePath && <a href={`/api/admin/files/${p.insurancePath}`} target="_blank" className="text-indigo-600 underline">E&amp;O insurance ↗</a>}
                  <span className={p.attestedCompliance ? "text-emerald-600" : "text-amber-600"}>
                    {p.attestedCompliance ? "Compliance attested ✓" : "No attestation"}
                  </span>
                </div>
                {p.experiences && <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{p.experiences}</p>}
                {p.pastCases.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {p.pastCases.map((pc) => (
                      <li key={pc.id}>• {pc.title} [{specialtyName(pc.category)}{pc.year ? `, ${pc.year}` : ""}]{pc.outcome ? ` — ${pc.outcome}` : ""}</li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          {!isConsultant && (
            <Card>
              <CardBody>
                <h2 className="mb-3 text-sm font-semibold text-slate-900">
                  Cases ({user.cases.length}) · Documents ({user.documents.length})
                </h2>
                <div className="space-y-2">
                  {user.cases.map((c) => (
                    <Link key={c.id} href={`/admin/cases/${c.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-mono text-xs text-indigo-600">{formatCaseNumber(c.number)}</span>
                        {c.title.slice(0, 60)}
                      </span>
                      <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-slate-500">
                        {c.issues.length} issues · {c.readinessScore}%
                        <Badge color={c.status === "analyzed" ? "green" : c.status === "consultant_recommended" ? "amber" : "slate"}>{c.status.replace(/_/g, " ")}</Badge>
                      </span>
                    </Link>
                  ))}
                  {user.cases.length === 0 && <p className="text-sm text-slate-400">No cases.</p>}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                {isConsultant ? `Client assignments (${user.consultantAssignments.length})` : `Consultant assignments (${user.clientAssignments.length})`}
              </h2>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {(isConsultant ? user.consultantAssignments : user.clientAssignments).map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>
                      {isConsultant
                        ? `${(a as typeof user.consultantAssignments[number]).user.firstName} ${(a as typeof user.consultantAssignments[number]).user.lastName}`
                        : `${(a as typeof user.clientAssignments[number]).consultant.firstName} ${(a as typeof user.clientAssignments[number]).consultant.lastName}`}
                      {a.autoAssigned && <Badge color="blue">AI</Badge>}
                    </span>
                    <Badge color={a.status === "active" ? "green" : a.status === "declined" || a.status === "revoked" ? "red" : "amber"}>{a.status.replace(/_/g, " ")}</Badge>
                  </li>
                ))}
                {(isConsultant ? user.consultantAssignments : user.clientAssignments).length === 0 && (
                  <li className="text-slate-400">None.</li>
                )}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Support tickets ({user.tickets.length})</h2>
              <div className="space-y-1.5">
                {user.tickets.map((t) => (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-xs text-indigo-600">{formatTicketNumber(t.number)}</span>
                      {t.subject.slice(0, 50)}
                    </span>
                    <Badge color={t.status === "resolved" ? "green" : t.status === "closed" ? "slate" : "amber"}>{t.status.replace(/_/g, " ")}</Badge>
                  </Link>
                ))}
                {user.tickets.length === 0 && <p className="text-sm text-slate-400">No tickets.</p>}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
