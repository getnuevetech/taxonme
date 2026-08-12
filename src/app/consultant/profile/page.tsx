import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, ProgressBar, Badge } from "@/components/ui";
import { ConsultantProfileForm } from "@/components/consultant-profile-form";
import { consultantCompleteness } from "@/lib/consultant-completeness";

export const metadata = { title: "My profile" };

export default async function ConsultantProfilePage() {
  const user = await requireUser();
  const profile = await db.consultantProfile.findUnique({ where: { userId: user.id } });
  const { items, pct } = consultantCompleteness(user, profile);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <PageHeader
          title="My profile"
          subtitle="Every item on your profile is required to work with clients — complete it at your own pace."
        />
        <Card>
          <CardBody>
            <ConsultantProfileForm
              user={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                address: user.address,
                bio: user.bio,
                avatarPath: user.avatarPath,
              }}
              languages={profile?.languages ?? ""}
              website={profile?.website ?? ""}
            />
          </CardBody>
        </Card>
        <Card className="mt-6">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Credentials & practice</h2>
                <p className="text-sm text-slate-500">
                  License, PTIN, proof documents, specialties, and states served are managed under My credentials.
                </p>
              </div>
              <Link href="/consultant/onboarding" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Edit credentials →
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <Card>
          <CardBody>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Profile completeness</h3>
              {pct === 100 && <Badge color="green">Complete</Badge>}
            </div>
            <ProgressBar value={pct} />
            <ul className="mt-4 space-y-2">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i.done ? "bg-emerald-100 text-emerald-700" : "border-2 border-dashed border-slate-300 text-transparent"}`}>
                    ✓
                  </span>
                  {i.done ? (
                    <span className="text-slate-400 line-through">{i.label}</span>
                  ) : (
                    <Link href={i.href} className="font-medium text-slate-700 hover:text-indigo-600">{i.label}</Link>
                  )}
                </li>
              ))}
            </ul>
            {pct < 100 && (
              <p className="mt-3 text-xs text-slate-400">
                A complete profile builds client trust and improves your match ranking.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
