import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata = { title: "Support tickets" };

const statusColor = (s: string) => (s === "resolved" ? "green" : s === "closed" ? "slate" : s === "in_progress" ? "blue" : "amber");

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await db.ticket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Support tickets"
        subtitle="Technical problems go to tech support; everything else goes to customer service. We'll keep you posted here and by notification."
        actions={<ButtonLink href="/app/support/new">New ticket →</ButtonLink>}
      />
      {tickets.length === 0 ? (
        <EmptyState
          title="No tickets"
          body="If you hit a snag — technical or otherwise — open a ticket and our team will take care of it."
          action={<ButtonLink href="/app/support/new">Create a ticket</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link key={t.id} href={`/app/support/${t.id}`} className="block">
              <Card className="transition hover:border-indigo-300">
                <CardBody className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{t.subject}</p>
                    <p className="text-xs text-slate-500">
                      #{t.id.slice(-6).toUpperCase()} · {t.category === "tech_support" ? "Tech support" : "Customer service"} ·{" "}
                      {t._count.messages} message{t._count.messages === 1 ? "" : "s"} · updated {t.updatedAt.toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <Badge color={statusColor(t.status)}>{t.status.replace(/_/g, " ")}</Badge>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
