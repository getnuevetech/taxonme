import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { MessageTemplateForm, PushMessageForm } from "@/components/admin/message-forms";
import { deleteMessageTemplateAction, runScheduledMessagesAction } from "@/actions/admin";

export const metadata = { title: "System messages" };

const KIND_LABEL: Record<string, string> = {
  event: "Event — sent automatically on activity",
  scheduled: "Scheduled — sent relative to subscription expiration",
  custom: "Custom — pushed manually",
};

export default async function AdminMessagesPage() {
  await guardAdminPage("admin.messages");
  const [templates, recentLogs] = await Promise.all([
    db.messageTemplate.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.messageLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 15,
      include: { template: { select: { name: true } } },
    }),
  ]);
  const logUsers = await db.user.findMany({
    where: { id: { in: Array.from(new Set(recentLogs.map((l) => l.userId))) } },
    select: { id: true, email: true },
  });
  const emailOf = (id: string) => logUsers.find((u) => u.id === id)?.email ?? "(deleted account)";
  const kinds = ["event", "scheduled", "custom"] as const;

  return (
    <div>
      <PageHeader
        title="System messages"
        subtitle="Every message the platform sends to customers and consultants — account events, subscription reminders, and manual pushes. Templates support HTML and placeholders."
        actions={
          <form action={runScheduledMessagesAction}>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ▶ Run scheduled messages now
            </button>
          </form>
        }
      />

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Push a message to a customer or consultant</h2>
          <PushMessageForm templates={templates.filter((t) => t.enabled).map((t) => ({ key: t.key, name: t.name }))} />
        </CardBody>
      </Card>

      {kinds.map((kind) => {
        const list = templates.filter((t) => t.kind === kind);
        return (
          <section key={kind} className="mb-8">
            <h2 className="mb-1 text-base font-semibold text-slate-900 capitalize">{kind} messages</h2>
            <p className="mb-3 text-xs text-slate-500">{KIND_LABEL[kind]}</p>
            <div className="space-y-3">
              {list.map((t) => (
                <Card key={t.key}>
                  <CardBody>
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{t.name}</span>
                        <Badge>{t.key}</Badge>
                        {t.kind === "scheduled" && t.offsetDays !== null && (
                          <Badge color="indigo">
                            {t.offsetDays < 0
                              ? `${-t.offsetDays} day${-t.offsetDays === 1 ? "" : "s"} before expiration`
                              : t.offsetDays === 0
                                ? "on expiration"
                                : `${t.offsetDays} day${t.offsetDays === 1 ? "" : "s"} after expiration`}
                          </Badge>
                        )}
                        <Badge color={t.enabled ? "green" : "red"}>{t.enabled ? "enabled" : "disabled"}</Badge>
                      </summary>
                      <div className="mt-4">
                        <MessageTemplateForm
                          template={{
                            key: t.key,
                            name: t.name,
                            subject: t.subject,
                            bodyHtml: t.bodyHtml,
                            kind: t.kind,
                            offsetDays: t.offsetDays,
                            enabled: t.enabled,
                          }}
                        />
                        <form action={deleteMessageTemplateAction.bind(null, t.key)} className="mt-2 text-right">
                          <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete message</button>
                        </form>
                      </div>
                    </details>
                  </CardBody>
                </Card>
              ))}
              {list.length === 0 && <p className="text-sm text-slate-400">None yet.</p>}
            </div>
          </section>
        );
      })}

      <Card>
        <CardBody>
          <h2 className="mb-3 font-semibold text-slate-900">Create a new message</h2>
          <MessageTemplateForm template={null} />
        </CardBody>
      </Card>

      <h2 className="mb-3 mt-10 text-base font-semibold text-slate-900">Recently sent</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {recentLogs.length === 0 && (
              <tr><td className="px-4 py-4 text-slate-400">No messages sent yet.</td></tr>
            )}
            {recentLogs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 text-slate-600">{l.sentAt.toLocaleString("en-US")}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{l.template.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{emailOf(l.userId)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Badge color={l.emailSent ? "green" : "slate"}>{l.emailSent ? "emailed + in-app" : "in-app only"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
