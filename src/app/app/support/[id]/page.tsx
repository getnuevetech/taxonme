import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { TicketReplyForm, RateTicket, AttachmentList } from "@/components/ticket-forms";
import { formatTicketNumber } from "@/lib/ticket-number";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireUser();
  const ticket = await db.ticket.findFirst({
    where: { id, userId: user.id },
    // Internal staff notes and audit entries are never shown to the user.
    include: {
      messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, include: { attachments: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={ticket.subject}
        subtitle={`Ticket ${formatTicketNumber(ticket.number)} · ${ticket.category === "tech_support" ? "Tech support" : "Customer service"}`}
      />
      {created && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ticket created — our team has been notified and will reply here.
        </div>
      )}
      <div className="mb-4">
        <Badge color={ticket.status === "resolved" ? "green" : ticket.status === "closed" ? "slate" : ticket.status === "in_progress" ? "blue" : "amber"}>
          {ticket.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <Card>
        <CardBody className="space-y-4">
          {ticket.messages.map((m) => (
            <div key={m.id} className={`flex ${m.fromStaff ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.fromStaff ? "bg-slate-100 text-slate-800" : "bg-indigo-600 text-white"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <AttachmentList attachments={m.attachments} light={!m.fromStaff} />
                <p className={`mt-1 text-[10px] ${m.fromStaff ? "text-slate-400" : "text-indigo-200"}`}>
                  {m.fromStaff ? "Support team" : "You"} · {m.createdAt.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
      {["resolved", "closed"].includes(ticket.status) && !ticket.csatRating && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <RateTicket ticketId={ticket.id} />
        </div>
      )}
      {ticket.csatRating && (
        <p className="mt-4 text-sm text-slate-500">
          You rated this ticket {"★".repeat(ticket.csatRating)}{"☆".repeat(5 - ticket.csatRating)} — thank you!
        </p>
      )}
      <div className="mt-4">
        {ticket.status === "closed" && (
          <p className="mb-2 text-xs text-slate-500">This ticket is closed — replying will reopen it.</p>
        )}
        <TicketReplyForm ticketId={ticket.id} staff={false} />
      </div>
    </div>
  );
}
