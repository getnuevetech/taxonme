import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { TicketReplyForm } from "@/components/ticket-forms";
import { closeOwnTicketAction } from "@/actions/support";

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
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={ticket.subject}
        subtitle={`Ticket #${ticket.id.slice(-6).toUpperCase()} · ${ticket.category === "tech_support" ? "Tech support" : "Customer service"}`}
        actions={
          ticket.status !== "closed" ? (
            <form action={closeOwnTicketAction.bind(null, ticket.id)}>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Close ticket
              </button>
            </form>
          ) : undefined
        }
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
                <p className={`mt-1 text-[10px] ${m.fromStaff ? "text-slate-400" : "text-indigo-200"}`}>
                  {m.fromStaff ? "Support team" : "You"} · {m.createdAt.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
      {ticket.status !== "closed" && (
        <div className="mt-4">
          <TicketReplyForm ticketId={ticket.id} staff={false} />
        </div>
      )}
    </div>
  );
}
