import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { respondToAssignmentAction } from "@/actions/user";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

export const metadata = { title: "My consultant" };

export default async function MyConsultantsPage() {
  const user = await requireUser();
  const assignments = await db.consultantAssignment.findMany({
    where: { userId: user.id, status: { not: "revoked" } },
    orderBy: { createdAt: "desc" },
    include: { consultant: { include: { consultantProfile: true } } },
  });
  const agreement = await db.contentPage.findFirst({
    where: { kind: "agreement_connection", isPublished: true },
    orderBy: { version: "desc" },
    select: { slug: true, title: true },
  });

  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My consultant"
        subtitle="When your case needs a professional, we propose a vetted CPA or Enrolled Agent. Nothing is shared until you approve."
      />
      {assignments.length === 0 ? (
        <EmptyState
          title="No consultant proposed yet"
          body="If your analysis shows your case would benefit from a professional, our team will recommend one that matches your situation. You always approve first."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const profile = a.consultant.consultantProfile;
            const specialties: string[] = profile ? JSON.parse(profile.specialties || "[]") : [];
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {a.consultant.firstName} {a.consultant.lastName}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {profile?.credentialType === "cpa" ? "Certified Public Accountant" : profile?.credentialType === "ea" ? "Enrolled Agent" : "Tax Consultant"}
                        {profile?.isBusiness && profile.businessName ? ` · ${profile.businessName}` : ""}
                        {profile ? ` · ${profile.yearsExperience} yrs experience` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {specialties.map((s) => (
                          <Badge key={s} color="indigo">{specialtyName(s)}</Badge>
                        ))}
                      </div>
                      {a.note && <p className="mt-2 text-sm text-slate-600">&ldquo;{a.note}&rdquo;</p>}
                    </div>
                    <Badge color={a.status === "active" ? "green" : a.status === "declined" ? "red" : "amber"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {a.status === "proposed" && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        By accepting, you authorize this consultant to view your case details and the documents you&apos;ve shared,
                        under the{" "}
                        {agreement ? (
                          <a href={`/p/${agreement.slug}`} target="_blank" className="font-medium text-indigo-600 underline">
                            {agreement.title}
                          </a>
                        ) : (
                          "connection agreement"
                        )}
                        . The connection becomes active only after the consultant also agrees.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <form action={respondToAssignmentAction.bind(null, a.id, true)}>
                          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                            I agree — connect us
                          </button>
                        </form>
                        <form action={respondToAssignmentAction.bind(null, a.id, false)}>
                          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                            No thanks
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                  {a.status === "user_accepted" && (
                    <p className="mt-3 text-sm text-slate-500">You&apos;ve agreed. Waiting for the consultant to accept the connection agreement.</p>
                  )}
                  {a.status === "active" && (
                    <p className="mt-3 text-sm text-emerald-700">Connection active — your consultant can now review your shared documents.</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
