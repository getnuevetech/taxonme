import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { TicketReplyForm } from "@/components/ticket-forms";
import { AssignAgentForm } from "@/components/admin/ticket-admin-forms";
import { formatTicketNumber } from "@/lib/ticket-number";
import { setTicketStatusAction, setTicketCategoryAction, setTicketPriorityAction } from "@/actions/support";

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  await guardAdminPage("admin.tickets");
  const [ticket, agents] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, phone: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["admin", "super_admin"] }, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
  ]);
  if (!ticket) notFound();

  const actionButton = (label: string, action: () => Promise<void>, color: string) => (
    <form action={action}>
      <button className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${color}`}>{label}</button>
    </form>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={ticket.subject}
        subtitle={`${formatTicketNumber(ticket.number)} · ${ticket.user.firstName} ${ticket.user.lastName} (${ticket.user.email}${ticket.user.phone ? ` · ${ticket.user.phone}` : ""}) · opened ${ticket.createdAt.toLocaleString("en-US")} · source: ${ticket.source}`}
      />

      {created && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ticket created on behalf of the user — they&apos;ve been notified and can reply from their Support section.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge color={ticket.status === "resolved" ? "green" : ticket.status === "in_progress" ? "blue" : "amber"}>{ticket.status.replace(/_/g, " ")}</Badge>
        <Badge color={ticket.category === "tech_support" ? "blue" : "indigo"}>
          {ticket.category === "tech_support" ? "Tech support" : "Customer service"}
        </Badge>
        <Badge color={ticket.priority === "urgent" ? "red" : ticket.priority === "high" ? "amber" : "slate"}>{ticket.priority}</Badge>
        {ticket.assignedTo && (
          <Badge color="blue">Agent: {`${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`.trim() || ticket.assignedTo.email}</Badge>
        )}
      </div>

      <div className="mb-6">
        <AssignAgentForm
          ticketId={ticket.id}
          currentAgentId={ticket.assignedToId ?? ""}
          agents={agents.map((a) => ({ id: a.id, label: `${a.firstName} ${a.lastName}`.trim() || a.email }))}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {actionButton(
          ticket.category === "tech_support" ? "Route to customer service" : "Route to tech support",
          setTicketCategoryAction.bind(null, ticket.id, ticket.category === "tech_support" ? "customer_service" : "tech_support"),
          "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
        )}
        {ticket.status !== "resolved" && actionButton("Mark resolved", setTicketStatusAction.bind(null, ticket.id, "resolved"), "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")}
        {ticket.status !== "closed" && actionButton("Close", setTicketStatusAction.bind(null, ticket.id, "closed"), "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}
        {(ticket.status === "resolved" || ticket.status === "closed") && actionButton("Reopen", setTicketStatusAction.bind(null, ticket.id, "open"), "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100")}
        {ticket.priority !== "urgent" && actionButton("Escalate to urgent", setTicketPriorityAction.bind(null, ticket.id, "urgent"), "border-red-200 bg-red-50 text-red-600 hover:bg-red-100")}
        {ticket.priority === "urgent" && actionButton("De-escalate", setTicketPriorityAction.bind(null, ticket.id, "normal"), "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">First response</p>
          <p className="text-sm font-semibold text-slate-800">
            {ticket.firstResponseAt
              ? `${Math.round((ticket.firstResponseAt.getTime() - ticket.createdAt.getTime()) / 3600000 * 10) / 10}h after opening`
              : "Awaiting first response"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Resolved</p>
          <p className="text-sm font-semibold text-slate-800">{ticket.resolvedAt ? ticket.resolvedAt.toLocaleString("en-US") : "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Age</p>
          <p className="text-sm font-semibold text-slate-800">
            {Math.max(1, Math.round((Date.now() - ticket.createdAt.getTime()) / 3600000))}h
          </p>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {ticket.messages.map((m) =>
            m.system ? (
              <p key={m.id} className="text-center text-[11px] text-slate-400">
                ⚙ {m.body} · {m.createdAt.toLocaleString("en-US")}
              </p>
            ) : (
              <div key={m.id} className={`flex ${m.fromStaff ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.internal
                      ? "border border-amber-300 bg-amber-50 text-amber-900"
                      : m.fromStaff
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.internal && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">Internal note</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.internal ? "text-amber-500" : m.fromStaff ? "text-indigo-200" : "text-slate-400"}`}>
                    {m.fromStaff ? "Support team" : "User"} · {m.createdAt.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            ),
          )}
        </CardBody>
      </Card>
      <div className="mt-4">
        <TicketReplyForm ticketId={ticket.id} staff />
      </div>
    </div>
  );
}
