import { Card, CardBody, Badge } from "@/components/ui";
import { getVisibleComments, getComposerCheckbox, type ViewerRole } from "@/lib/case-comments";
import { CommentComposer } from "./comment-composer";

const roleBadge: Record<string, { label: string; color: string }> = {
  customer: { label: "Customer", color: "indigo" },
  consultant: { label: "Consultant", color: "amber" },
  admin: { label: "Support team", color: "blue" },
};

// Shared case discussion thread — same content model for all three portals,
// with role-appropriate visibility (enforced server-side).
export async function CaseComments({ caseId, viewer }: { caseId: string; viewer: { role: ViewerRole; userId: string } }) {
  const [comments, checkboxLabel] = await Promise.all([
    getVisibleComments(caseId, viewer.role, viewer.userId),
    getComposerCheckbox(viewer.role),
  ]);

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Case discussion</h2>
      <Card>
        <CardBody>
          <div className="space-y-4">
            {comments.length === 0 && (
              <p className="text-sm text-slate-400">
                No comments yet. {viewer.role === "customer" ? "Ask a question about your case, or leave a note." : "Add a review comment for this case."}
              </p>
            )}
            {comments.map((cm) => (
              <div key={cm.id} className={`rounded-xl border p-3.5 ${cm.visibility === "private" ? "border-slate-200 bg-slate-50" : cm.visibility === "hidden_from_customer" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{cm.isOwn ? "You" : cm.authorName}</span>
                  <Badge color={roleBadge[cm.authorRole]?.color ?? "slate"}>{roleBadge[cm.authorRole]?.label ?? cm.authorRole}</Badge>
                  {cm.visibility === "hidden_from_customer" && <Badge color="amber">Hidden from customer</Badge>}
                  {cm.visibility === "private" && <Badge>Private note</Badge>}
                  <span className="text-xs text-slate-400">{cm.createdAt.toLocaleString("en-US")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{cm.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <CommentComposer caseId={caseId} checkboxLabel={checkboxLabel} />
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
