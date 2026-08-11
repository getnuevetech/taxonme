import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Stat, Card, CardBody } from "@/components/ui";
import { AdminCreateTicketForm } from "@/components/admin/ticket-admin-forms";
import { CannedResponseForm } from "@/components/admin/canned-response-forms";
import { deleteCannedResponseAction } from "@/actions/support";
import { formatTicketNumber } from "@/lib/ticket-number";

export const metadata = { title: "Support tickets" };

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; agent?: string }>;
}) {
  const admin = await guardAdminPage("admin.tickets");
  // Opportunistic sweep: close tickets the customer stopped responding to.
  const { autoCloseInactiveTickets } = await import("@/actions/support");
  await autoCloseInactiveTickets();
  const f = await searchParams;
  const where: Prisma.TicketWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.category) where.category = f.category;
  if (f.agent === "me") where.assignedToId = admin.id;
  else if (f.agent === "unassigned") where.assignedToId = null;
  if (f.q?.trim()) {
    const q = f.q.trim();
    const asNumber = Number(q.replace(/^TKT-?/i, ""));
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
      ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
    ];
  }

  const [tickets, openCount, techCount, serviceCount, agents] = await Promise.all([
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
      where: { role: { in: ["admin", "super_admin"] }, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
  ]);
  const { getNumberSetting, getSetting } = await import("@/lib/settings");
  const slaHours = await getNumberSetting("tickets.sla_first_response_hours", 24);
  const slaCutoff = new Date(Date.now() - slaHours * 3600000);
  const awaitingFirstResponse = await db.ticket.count({
    where: { status: { in: ["open", "in_progress"] }, firstResponseAt: null },
  });
  const [csat, canned, inboundSecret] = await Promise.all([
    db.ticket.aggregate({ where: { csatRating: { not: null } }, _avg: { csatRating: true }, _count: { csatRating: true } }),
    db.cannedResponse.findMany({ orderBy: { title: "asc" } }),
    getSetting("tickets.inbound_email_secret", ""),
  ]);
  const isOverdue = (t: { status: string; firstResponseAt: Date | null; createdAt: Date }) =>
    ["open", "in_progress"].includes(t.status) && !t.firstResponseAt && t.createdAt < slaCutoff;

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
      <div className="mb-6 grid gap-4 sm:grid-cols-5">
        <Stat label="Open tickets" value={openCount} />
        <Stat label="Awaiting first response" value={awaitingFirstResponse} sub={`SLA: ${slaHours}h`} />
        <Stat label="Tech support queue" value={techCount} />
        <Stat label="Customer service queue" value={serviceCount} />
        <Stat
          label="CSAT"
          value={csat._count.csatRating ? `${Math.round((csat._avg.csatRating ?? 0) * 10) / 10}/5` : "—"}
          sub={csat._count.csatRating ? `${csat._count.csatRating} rating(s)` : "no ratings yet"}
        />
      </div>

      <Card className="mb-6">
        <CardBody>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              + Create a ticket on behalf of a customer or consultant
            </summary>
            <div className="mt-4">
              <AdminCreateTicketForm
                agents={agents.map((a) => ({ id: a.id, label: `${a.firstName} ${a.lastName}`.trim() || a.email }))}
              />
            </div>
          </details>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardBody>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              Canned responses ({canned.length}) & inbound email
            </summary>
            <div className="mt-4 space-y-4">
              {canned.map((c) => (
                <details key={c.id} className="rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {c.title} <Badge>{c.category === "all" ? "both queues" : c.category.replace(/_/g, " ")}</Badge>
                  </summary>
                  <div className="mt-3">
                    <CannedResponseForm canned={{ id: c.id, title: c.title, body: c.body, category: c.category }} />
                    <form action={deleteCannedResponseAction.bind(null, c.id)} className="mt-1 text-right">
                      <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                    </form>
                  </div>
                </details>
              ))}
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">New canned response</p>
                <CannedResponseForm canned={null} />
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Inbound email-to-ticket</p>
                {inboundSecret ? (
                  <p className="mt-1">
                    Enabled. Point your email provider&apos;s inbound webhook (SendGrid Inbound Parse, Mailgun Routes, Postmark) at{" "}
                    <code className="rounded bg-white px-1">/api/inbound-email?secret=…</code>. Emails from registered users create
                    tickets; replies containing a TKT number are appended to that ticket.
                  </p>
                ) : (
                  <p className="mt-1">
                    Disabled. Set <code className="rounded bg-white px-1">tickets.inbound_email_secret</code> in App settings to a
                    long random value, then point your email provider&apos;s inbound webhook at{" "}
                    <code className="rounded bg-white px-1">/api/inbound-email?secret=&lt;value&gt;</code>.
                  </p>
                )}
              </div>
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterLink("All", "", !f.status && !f.category && !f.agent)}
        {filterLink("Open", "?status=open", f.status === "open")}
        {filterLink("In progress", "?status=in_progress", f.status === "in_progress")}
        {filterLink("Resolved", "?status=resolved", f.status === "resolved")}
        {filterLink("Tech support", "?category=tech_support", f.category === "tech_support")}
        {filterLink("Customer service", "?category=customer_service", f.category === "customer_service")}
        {filterLink("My tickets", "?agent=me", f.agent === "me")}
        {filterLink("Unassigned", "?agent=unassigned", f.agent === "unassigned")}
        <form method="get" className="ml-auto flex gap-2">
          <input
            name="q"
            defaultValue={f.q ?? ""}
            placeholder="Search: TKT number, subject, user…"
            className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Search</button>
        </form>
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
                  <p className="text-xs text-slate-400">{formatTicketNumber(t.number)} · {t._count.messages} msg</p>
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
                  <div className="flex flex-col items-start gap-1">
                    <Badge color={t.status === "resolved" ? "green" : t.status === "closed" ? "slate" : t.status === "in_progress" ? "blue" : "amber"}>
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                    {isOverdue(t) && <Badge color="red">SLA overdue</Badge>}
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
