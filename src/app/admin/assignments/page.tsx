import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { revokeAssignmentAction } from "@/actions/admin";
import { AssignmentForm, AutoAssignToggle } from "@/components/admin/assignment-form";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";
import { getBoolSetting } from "@/lib/settings";

export const metadata = { title: "Assignments" };

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: highlightCase } = await searchParams;
  await guardAdminPage("admin.assignments");
  const autoAssignEnabled = await getBoolSetting("consultants.auto_assign_enabled", false);

  const [assignments, users, consultants, flaggedCases] = await Promise.all([
    db.consultantAssignment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        consultant: { select: { firstName: true, lastName: true, email: true } },
        case: { select: { title: true } },
      },
    }),
    db.user.findMany({ where: { role: "user", status: "active" }, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
    db.user.findMany({
      where: { role: "consultant", consultantProfile: { status: "approved" } },
      include: { consultantProfile: true },
    }),
    db.case.findMany({
      where: { status: "consultant_recommended" },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, issues: { select: { issueType: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Consultant assignments"
        subtitle="Propose a consultant to a user. The connection activates only after both parties agree."
      />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">AI auto-assignment</h2>
          <p className="mb-3 text-xs text-slate-500">
            When enabled, cases flagged for professional review are automatically matched to the best-fitting approved
            consultant (specialties, experience, past cases, workload), with an AI-written recommendation shown to both
            parties. Both still have to consent, and you can revoke or override any proposal below.
          </p>
          <AutoAssignToggle enabled={autoAssignEnabled} />
        </CardBody>
      </Card>

      {flaggedCases.length > 0 && (
        <Card className="mb-6 border-amber-300">
          <CardBody>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Cases flagged: consultant recommended</h2>
            <ul className="space-y-1 text-sm text-slate-600">
              {flaggedCases.map((c) => (
                <li key={c.id} className={c.id === highlightCase ? "rounded bg-amber-50 px-2 py-1 font-medium" : ""}>
                  {c.user ? `${c.user.firstName} ${c.user.lastName} (${c.user.email})` : "Guest"} — &ldquo;{c.title}&rdquo;
                  <span className="text-slate-400"> · issues: {Array.from(new Set(c.issues.map((i) => i.issueType))).join(", ") || "n/a"}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Propose a new assignment</h2>
          <AssignmentForm
            users={users.map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName} · ${u.email}` }))}
            consultants={consultants.map((c) => ({
              id: c.id,
              label: `${c.firstName} ${c.lastName} · ${c.consultantProfile?.credentialType.toUpperCase()} · ${(JSON.parse(c.consultantProfile?.specialties || "[]") as string[]).map(specialtyName).join(", ")}`,
            }))}
          />
        </CardBody>
      </Card>

      <h2 className="mb-3 text-base font-semibold text-slate-900">All assignments</h2>
      <div className="space-y-3">
        {assignments.length === 0 && <p className="text-sm text-slate-400">No assignments yet.</p>}
        {assignments.map((a) => (
          <Card key={a.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {a.user.firstName} {a.user.lastName} ↔ {a.consultant.firstName} {a.consultant.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {a.case?.title ? `Case: ${a.case.title} · ` : ""}
                  user consent: {a.userAgreedAt ? "✓" : "pending"} · consultant consent: {a.consultantAgreedAt ? "✓" : "pending"}
                </p>
                {a.reasonSummary && <p className="mt-1 text-xs text-slate-600">{a.reasonSummary}</p>}
                {a.reasonDetail && (
                  <details className="mt-0.5">
                    <summary className="cursor-pointer text-xs font-medium text-indigo-600">Detailed reasoning</summary>
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{a.reasonDetail}</p>
                  </details>
                )}
              </div>
              <div className="flex items-center gap-3">
                {a.autoAssigned && <Badge color="blue">AI auto-assigned</Badge>}
                <Badge color={a.status === "active" ? "green" : a.status === "declined" || a.status === "revoked" ? "red" : "amber"}>
                  {a.status.replace(/_/g, " ")}
                </Badge>
                {a.status !== "revoked" && (
                  <form action={revokeAssignmentAction.bind(null, a.id)}>
                    <button className="text-xs font-medium text-red-500 hover:text-red-700">Revoke</button>
                  </form>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
