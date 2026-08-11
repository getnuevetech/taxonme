import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { GatewayForm } from "@/components/admin/gateway-form";
import { deleteGatewayAction } from "@/actions/admin";

export const metadata = { title: "Payment gateways" };

export default async function AdminPaymentsPage() {
  await guardAdminPage("admin.payments");
  const gateways = await db.paymentGatewayConfig.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Payment gateways"
        subtitle="Integrate payment and subscription APIs here. All keys and settings live in this configuration — nothing is hardcoded."
        actions={
          <Link href="/admin/transactions" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View transactions →
          </Link>
        }
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

    </div>
  );
}
