import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, StateMark, EmptyState } from "@/components/ui";
import { setDeadlineStatusAction } from "@/actions/user";
import { AddDeadlineForm } from "@/components/deadline-form";

export const metadata = { title: "Deadlines" };

export default async function DeadlinesPage() {
  const user = await requireUser();
  const deadlines = await db.deadline.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  return (
    <div>
      <PageHeader title="Deadlines" subtitle="Dates from notices and analyses land here automatically. Add your own too." />
      <Card className="mb-6">
        <CardBody>
          <AddDeadlineForm />
        </CardBody>
      </Card>
      {deadlines.length === 0 ? (
        <EmptyState title="No deadlines tracked" body="When we find a respond-by date on a notice, it appears here." />
      ) : (
        <div className="space-y-3">
          {deadlines.map((d) => {
            const overdue = d.status === "open" && d.dueDate < now;
            const urgent = d.status === "open" && !overdue && d.dueDate <= soon;
            return (
              <Card key={d.id}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`font-medium ${d.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{d.title}</p>
                    <p className="text-xs text-slate-500">
                      Due {d.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {d.source !== "manual" && ` · from ${d.source}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StateMark state={d.status === "done" ? "resolved" : overdue ? "urgent" : urgent ? "action_needed" : "review"} />
                    <form action={setDeadlineStatusAction.bind(null, d.id, d.status === "done" ? "open" : "done")}>
                      <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                        {d.status === "done" ? "Reopen" : "Mark done ✓"}
                      </button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
