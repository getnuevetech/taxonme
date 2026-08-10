import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge } from "@/components/ui";
import { setUserStatusAction, adminDeleteUserAction } from "@/actions/admin";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await guardAdminPage("admin.users");
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { where: { status: { in: ["active", "trialing"] } }, include: { plan: true }, take: 1 },
      _count: { select: { cases: true, documents: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.length} accounts across all roles.`} />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={u.role === "super_admin" ? "indigo" : u.role === "admin" ? "blue" : u.role === "consultant" ? "amber" : "slate"}>
                    {u.role.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.subscriptions[0]?.plan.name ?? "Free"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u._count.cases} cases · {u._count.documents} docs
                </td>
                <td className="px-4 py-3">
                  <Badge color={u.status === "active" ? "green" : "red"}>{u.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role !== "super_admin" && (
                    <div className="flex justify-end gap-3 text-xs font-medium">
                      <form action={setUserStatusAction.bind(null, u.id, u.status === "active" ? "suspended" : "active")}>
                        <button className="text-amber-600 hover:text-amber-800">
                          {u.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      </form>
                      <form action={adminDeleteUserAction.bind(null, u.id)}>
                        <button className="text-red-500 hover:text-red-700">Delete</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
