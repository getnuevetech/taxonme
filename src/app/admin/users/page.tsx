import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge } from "@/components/ui";
import { PeopleTabs } from "@/components/admin/people-tabs";
import { ConfirmForm } from "@/components/confirm-form";
import { ResetLinkButton } from "@/components/admin/reset-link-button";
import { setUserStatusAction, adminDeleteUserAction } from "@/actions/admin";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  await guardAdminPage("admin.users");
  // This section manages customers only — consultants and admins have their own sections.
  const users = await db.user.findMany({
    where: { role: "user", status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { where: { status: { in: ["active", "trialing"] } }, include: { plan: true }, take: 1 },
      _count: { select: { cases: true, documents: true, clientAssignments: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Regular users of the platform — the taxpayers you're helping."
      />
      <PeopleTabs active="customers" />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Consultant</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No customers yet.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={u.subscriptions[0] ? "indigo" : "slate"}>{u.subscriptions[0]?.plan.name ?? "Free"}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u._count.cases} cases · {u._count.documents} docs
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u._count.clientAssignments > 0 ? `${u._count.clientAssignments} assignment(s)` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.createdAt.toLocaleDateString("en-US")}</td>
                <td className="px-4 py-3">
                  <Badge color={u.status === "active" ? "green" : "red"}>{u.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap items-start justify-end gap-3 text-xs font-medium">
                    <ResetLinkButton userId={u.id} />
                    <form action={setUserStatusAction.bind(null, u.id, u.status === "active" ? "suspended" : "active")}>
                      <button className="text-amber-600 hover:text-amber-800">
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </form>
                    <ConfirmForm
                      action={adminDeleteUserAction.bind(null, u.id)}
                      message={`Delete ${u.email}? The account moves to Deleted accounts and is expunged automatically after the retention period. You can restore it until then.`}
                    >
                      <button className="text-red-500 hover:text-red-700">Delete</button>
                    </ConfirmForm>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
