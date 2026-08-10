import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge, Money } from "@/components/ui";
import { GatewayForm } from "@/components/admin/gateway-form";
import { deleteGatewayAction } from "@/actions/admin";

export const metadata = { title: "Payment gateways" };

export default async function AdminPaymentsPage() {
  await guardAdminPage("admin.payments");
  const [gateways, transactions] = await Promise.all([
    db.paymentGatewayConfig.findMany({ orderBy: { updatedAt: "desc" } }),
    db.paymentTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { email: true } }, plan: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Payment gateways"
        subtitle="Integrate payment and subscription APIs here. All keys and settings live in this configuration — nothing is hardcoded."
      />
      <div className="space-y-6">
        {gateways.map((g) => (
          <Card key={g.id}>
            <CardBody>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">{g.name}</h2>
                <Badge>{g.kind}</Badge>
                <Badge color={g.mode === "live" ? "green" : "amber"}>{g.mode}</Badge>
                {g.isDefault && <Badge color="indigo">default</Badge>}
                {!g.isActive && <Badge color="red">inactive</Badge>}
              </div>
              <GatewayForm
                gateway={{ id: g.id, name: g.name, kind: g.kind, mode: g.mode, isActive: g.isActive, isDefault: g.isDefault, configJson: g.configJson }}
              />
              <form action={deleteGatewayAction.bind(null, g.id)} className="mt-2 text-right">
                <button className="text-xs font-medium text-red-500 hover:text-red-700">Remove gateway</button>
              </form>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Add a gateway</h2>
            <GatewayForm gateway={null} />
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 mt-10 text-base font-semibold text-slate-900">Recent transactions</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 && (
              <tr><td className="px-4 py-4 text-slate-400">No transactions yet.</td></tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-slate-600">{t.createdAt.toLocaleString("en-US")}</td>
                <td className="px-4 py-3">{t.user.email}</td>
                <td className="px-4 py-3">{t.plan?.name ?? "—"}</td>
                <td className="px-4 py-3 font-medium"><Money cents={t.amountCents} /></td>
                <td className="px-4 py-3 text-slate-500">{t.gateway}</td>
                <td className="px-4 py-3 text-right">
                  <Badge color={t.status === "succeeded" ? "green" : t.status === "failed" ? "red" : "slate"}>{t.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
