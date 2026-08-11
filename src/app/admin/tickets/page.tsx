import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Stat, Card, CardBody } from "@/components/ui";
import { AdminCreateTicketForm } from "@/components/admin/ticket-admin-forms";

export const metadata = { title: "Support tickets" };

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  await guardAdminPage("admin.tickets");
  const f = await searchParams;
  const where: Prisma.TicketWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.category) where.category = f.category;

  const [tickets, openCount, techCount, serviceCount, users, agents] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.ticket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    db.ticket.count({ where: { category: "tech_support", status: { in: ["open", "in_progress"] } } }),
    db.ticket.count({ where: { category: "customer_service", status: { in: ["open", "in_progress"] } } }),
    db.user.findMany({
      where: { role: { in: ["user", "consultant"] }, status: "active" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    }),
    db.user.findMany({
      where: { role: { in: ["admin", "super_admin"] }, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
  ]);

  const filterLink = (label: string, params: string, active: boolean) => (
    <Link
      href={`/admin/tickets${params}`}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${active ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Support tickets"
        subtitle="The standalone ticketing operation: issues are routed to tech support or customer service and documented here."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open tickets" value={openCount} />
        <Stat label="Tech support queue" value={techCount} />
        <Stat label="Customer service queue" value={serviceCount} />
      </div>

      <Card className="mb-6">
        <CardBody>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              + Create a ticket on behalf of a customer or consultant
            </summary>
            <div className="mt-4">
              <AdminCreateTicketForm
                users={users.map((u) => ({
                  id: u.id,
                  label: `${`${u.firstName} ${u.lastName}`.trim() || u.email} · ${u.email} (${u.role === "consultant" ? "consultant" : "customer"})`,
                }))}
                agents={agents.map((a) => ({ id: a.id, label: `${a.firstName} ${a.lastName}`.trim() || a.email }))}
              />
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterLink("All", "", !f.status && !f.category)}
        {filterLink("Open", "?status=open", f.status === "open")}
        {filterLink("In progress", "?status=in_progress", f.status === "in_progress")}
        {filterLink("Resolved", "?status=resolved", f.status === "resolved")}
        {filterLink("Tech support", "?category=tech_support", f.category === "tech_support")}
        {filterLink("Customer service", "?category=customer_service", f.category === "customer_service")}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No tickets match.</td></tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/tickets/${t.id}`} className="font-medium text-indigo-600 underline">
                    {t.subject.slice(0, 60)}
                  </Link>
                  <p className="text-xs text-slate-400">#{t.id.slice(-6).toUpperCase()} · {t._count.messages} msg</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{t.user.email}</td>
                <td className="px-4 py-3">
                  <Badge color={t.category === "tech_support" ? "blue" : "indigo"}>
                    {t.category === "tech_support" ? "Tech support" : "Customer service"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`.trim() || t.assignedTo.email : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge color={t.priority === "urgent" ? "red" : t.priority === "high" ? "amber" : "slate"}>{t.priority}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{t.source}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{t.updatedAt.toLocaleString("en-US")}</td>
                <td className="px-4 py-3">
                  <Badge color={t.status === "resolved" ? "green" : t.status === "closed" ? "slate" : t.status === "in_progress" ? "blue" : "amber"}>
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
