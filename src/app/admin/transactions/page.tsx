import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Money, Stat } from "@/components/ui";
import { inputClass } from "@/components/ui";

export const metadata = { title: "Transactions" };

const STATUSES = ["pending", "succeeded", "failed", "abandoned", "refunded"] as const;

type Filters = {
  q?: string;
  status?: string;
  gateway?: string;
  plan?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
};

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await guardAdminPage("admin.transactions");
  const f = await searchParams;

  // Build the where clause from every provided filter.
  const where: Prisma.PaymentTransactionWhereInput = {};
  const and: Prisma.PaymentTransactionWhereInput[] = [];

  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { id: { contains: q } },
        { gatewayRef: { contains: q } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { firstName: { contains: q, mode: "insensitive" } } },
        { user: { lastName: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q } } },
        { plan: { name: { contains: q, mode: "insensitive" } } },
        { plan: { key: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.status) and.push({ status: f.status });
  if (f.gateway) and.push({ gateway: f.gateway });
  if (f.plan) and.push({ planId: f.plan });
  if (f.from && !Number.isNaN(Date.parse(f.from))) and.push({ createdAt: { gte: new Date(f.from) } });
  if (f.to && !Number.isNaN(Date.parse(f.to))) {
    const to = new Date(f.to);
    to.setDate(to.getDate() + 1); // inclusive end date
    and.push({ createdAt: { lt: to } });
  }
  if (f.min && !Number.isNaN(Number(f.min))) and.push({ amountCents: { gte: Math.round(Number(f.min) * 100) } });
  if (f.max && !Number.isNaN(Number(f.max))) and.push({ amountCents: { lte: Math.round(Number(f.max) * 100) } });
  if (and.length) where.AND = and;

  const [transactions, plans, gateways, totals] = await Promise.all([
    db.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        plan: { select: { name: true } },
      },
    }),
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.paymentTransaction.findMany({ distinct: ["gateway"], select: { gateway: true } }),
    db.paymentTransaction.aggregate({
      where: { ...where, status: "succeeded" },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);
  const matchedCount = await db.paymentTransaction.count({ where });
  const hasFilters = Object.values(f).some((v) => v && String(v).trim() !== "");

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Every payment on the platform. Search and filter by any transaction attribute."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Matched transactions" value={matchedCount} sub={hasFilters ? "with current filters" : "all time"} />
        <Stat label="Succeeded (matched)" value={totals._count} />
        <Stat label="Revenue (matched, succeeded)" value={<Money cents={totals._sum.amountCents ?? 0} />} />
      </div>

      {/* Filter bar — plain GET form so filters live in the URL and are shareable. */}
      <form method="get" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Search</span>
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Email, name, phone, plan, transaction ID, gateway reference…"
              className={inputClass}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select name="status" defaultValue={f.status ?? ""} className={inputClass}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Gateway</span>
            <select name="gateway" defaultValue={f.gateway ?? ""} className={inputClass}>
              <option value="">Any gateway</option>
              {gateways.map((g) => <option key={g.gateway} value={g.gateway}>{g.gateway}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Plan</span>
            <select name="plan" defaultValue={f.plan ?? ""} className={inputClass}>
              <option value="">Any plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">From date</span>
            <input name="from" type="date" defaultValue={f.from ?? ""} className={inputClass} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">To date</span>
            <input name="to" type="date" defaultValue={f.to ?? ""} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Min $</span>
              <input name="min" type="number" step="0.01" defaultValue={f.min ?? ""} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-slate-600">Max $</span>
              <input name="max" type="number" step="0.01" defaultValue={f.max ?? ""} className={inputClass} />
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Apply filters
          </button>
          {hasFilters && (
            <a href="/admin/transactions" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Clear all
            </a>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {hasFilters ? "No transactions match these filters." : "No transactions yet."}
                </td>
              </tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  <p>{t.createdAt.toLocaleDateString("en-US")}</p>
                  <p className="text-xs text-slate-400">{t.createdAt.toLocaleTimeString("en-US")}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{`${t.user.firstName} ${t.user.lastName}`.trim() || "—"}</p>
                  <p className="text-xs text-slate-500">{t.user.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{t.plan?.name ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  <Money cents={t.amountCents} /> <span className="text-xs font-normal text-slate-400">{t.currency}</span>
                </td>
                <td className="px-4 py-3"><Badge>{t.gateway}</Badge></td>
                <td className="max-w-40 px-4 py-3">
                  <p className="truncate font-mono text-xs text-slate-500" title={t.gatewayRef || t.id}>
                    {t.gatewayRef || t.id}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={t.status === "succeeded" ? "green" : t.status === "failed" ? "red" : t.status === "refunded" ? "amber" : "slate"}>
                    {t.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {matchedCount > 200 && (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            Showing the 200 most recent of {matchedCount} matches — narrow the filters to see older transactions.
          </p>
        )}
      </div>
    </div>
  );
}
