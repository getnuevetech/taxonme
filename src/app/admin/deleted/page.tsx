import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Card, CardBody } from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { restoreUserAction, expungeUserAction } from "@/actions/admin";
import { purgeExpiredDeletedAccounts, getRetentionDays } from "@/lib/deleted-accounts";
import { RetentionForm } from "@/components/admin/retention-form";

export const metadata = { title: "Deleted accounts" };

export default async function DeletedAccountsPage() {
  await guardAdminPage("admin.users");
  // Opportunistic sweep: expunge anything past the retention window.
  await purgeExpiredDeletedAccounts();
  const [users, retentionDays] = await Promise.all([
    db.user.findMany({
      where: { status: "deleted" },
      orderBy: { deletedAt: "desc" },
    }),
    getRetentionDays(),
  ]);

  const daysLeft = (deletedAt: Date | null) => {
    if (!deletedAt) return retentionDays;
    const elapsed = (Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil(retentionDays - elapsed));
  };

  return (
    <div>
      <PageHeader
        title="Deleted accounts"
        subtitle={`Deleted accounts are held here for ${retentionDays} days before being expunged permanently. Restore anytime within that window.`}
      />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Retention period</h2>
          <RetentionForm days={retentionDays} />
        </CardBody>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Deleted</th>
              <th className="px-4 py-3">Expunges in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No deleted accounts.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={u.role === "consultant" ? "amber" : u.role === "admin" ? "blue" : "slate"}>
                    {u.role.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{u.deletedAt?.toLocaleString("en-US") ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={daysLeft(u.deletedAt) <= 7 ? "red" : "slate"}>
                    {daysLeft(u.deletedAt)} day{daysLeft(u.deletedAt) === 1 ? "" : "s"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    <form action={restoreUserAction.bind(null, u.id)}>
                      <button className="text-emerald-600 hover:text-emerald-800">Restore</button>
                    </form>
                    <ConfirmForm
                      action={expungeUserAction.bind(null, u.id)}
                      message={`Permanently expunge ${u.email}? This removes the account and ALL its data (cases, documents, letters) and cannot be undone.`}
                    >
                      <button className="text-red-500 hover:text-red-700">Expunge now</button>
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
