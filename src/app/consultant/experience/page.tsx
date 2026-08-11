import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { ExperienceForm, PastCaseForm } from "@/components/consultant-experience-forms";
import { deletePastCaseAction } from "@/actions/consultant";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

export const metadata = { title: "Experience & past cases" };

export default async function ConsultantExperiencePage() {
  const user = await requireUser();
  const profile = await db.consultantProfile.findUnique({
    where: { userId: user.id },
    include: { pastCases: { orderBy: { createdAt: "desc" } } },
  });
  const categoryName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Experience & past cases"
        subtitle="This is how our matching engine decides which clients fit you best — the more detail you add, the better your matches."
      />
      {!profile ? (
        <EmptyState title="Complete your onboarding first" body="Submit your credentials under My credentials, then come back here." />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Your experience</h2>
              <p className="mb-3 text-xs text-slate-500">
                List the kinds of matters you&apos;ve handled, one per line — e.g. &ldquo;Negotiated 40+ installment agreements&rdquo;, &ldquo;CP2000 responses for self-employed clients&rdquo;.
              </p>
              <ExperienceForm experiences={profile.experiences} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Past cases handled ({profile.pastCases.length})</h2>
              <div className="mb-4 space-y-2">
                {profile.pastCases.length === 0 && (
                  <p className="text-sm text-slate-400">No past cases recorded yet. Never include client names or identifying details.</p>
                )}
                {profile.pastCases.map((pc) => (
                  <div key={pc.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {pc.title} {pc.year && <span className="font-normal text-slate-400">· {pc.year}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge color="indigo">{categoryName(pc.category)}</Badge>
                        {pc.outcome && <Badge color="green">{pc.outcome}</Badge>}
                      </div>
                      {pc.description && <p className="mt-1 text-xs text-slate-500">{pc.description}</p>}
                    </div>
                    <form action={deletePastCaseAction.bind(null, pc.id)}>
                      <button className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add a past case</h3>
              <PastCaseForm />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
