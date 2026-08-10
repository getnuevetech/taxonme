import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { consultantRespondAssignmentAction } from "@/actions/consultant";

export const metadata = { title: "Consultant dashboard" };

export default async function ConsultantDashboard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const user = await requireUser();
  const profile = await db.consultantProfile.findUnique({ where: { userId: user.id } });
  const assignments = await db.consultantAssignment.findMany({
    where: { consultantId: user.id, status: { notIn: ["revoked", "declined"] } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, email: true } }, case: { select: { id: true, title: true } } },
  });
  const agreement = await db.contentPage.findFirst({
    where: { kind: "agreement_connection", isPublished: true },
    select: { slug: true, title: true },
  });

  return (
    <div>
      <PageHeader title="Your practice" subtitle={`Welcome, ${user.firstName || user.email}`} />

      {submitted && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Application received. {profile?.status === "approved" ? "You're approved and ready to accept clients." : "Our team reviews applications manually — we'll notify you."}
        </div>
      )}

      {!profile && (
        <Card className="mb-6 border-amber-300">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Complete your professional onboarding</p>
              <p className="text-sm text-slate-500">We need your credentials, proof, and specialties before you can be assigned clients.</p>
            </div>
            <ButtonLink href="/consultant/onboarding">Start onboarding →</ButtonLink>
          </CardBody>
        </Card>
      )}

      {profile && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Account status</p>
              <p className="font-semibold capitalize text-slate-900">{profile.status}{profile.autoApproved ? " (auto-approved)" : ""}</p>
              {profile.status === "pending" && <p className="text-xs text-slate-400">An administrator reviews every application manually.</p>}
              {profile.status === "rejected" && profile.rejectionReason && (
                <p className="text-xs text-red-500">Reason: {profile.rejectionReason}</p>
              )}
            </div>
            <Badge color={profile.status === "approved" ? "green" : profile.status === "rejected" ? "red" : "amber"}>
              {profile.credentialType.toUpperCase().replace("_", " ")}
            </Badge>
          </CardBody>
        </Card>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Client assignments</h2>
      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          body="When our team matches you with a client whose situation fits your specialties, the proposal appears here. Both you and the client must agree before anything is shared."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardBody>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{a.user.firstName} {a.user.lastName}</p>
                    <p className="text-sm text-slate-500">{a.status === "active" ? a.user.email : "Contact details unlock when the connection is active"}</p>
                    {a.note && <p className="mt-1 text-sm text-slate-600">&ldquo;{a.note}&rdquo;</p>}
                  </div>
                  <Badge color={a.status === "active" ? "green" : "amber"}>{a.status.replace(/_/g, " ")}</Badge>
                </div>

                {!a.consultantAgreedAt && a.status !== "active" && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      Accepting means you agree to the{" "}
                      {agreement ? (
                        <a href={`/p/${agreement.slug}`} target="_blank" className="font-medium text-indigo-600 underline">{agreement.title}</a>
                      ) : ("connection agreement")}{" "}
                      covering confidentiality and handling of the client&apos;s sensitive materials.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <form action={consultantRespondAssignmentAction.bind(null, a.id, true)}>
                        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                          Accept assignment
                        </button>
                      </form>
                      <form action={consultantRespondAssignmentAction.bind(null, a.id, false)}>
                        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                          Decline
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                {a.consultantAgreedAt && !a.userAgreedAt && (
                  <p className="mt-3 text-sm text-slate-500">You&apos;ve accepted. Waiting for the client to approve the connection.</p>
                )}
                {a.status === "active" && (
                  <div className="mt-3">
                    <Link href={`/consultant/clients/${a.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                      Open client workspace →
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
