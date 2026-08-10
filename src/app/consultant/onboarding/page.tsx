import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ConsultantOnboardingForm } from "@/components/consultant-onboarding-form";

export const metadata = { title: "Consultant onboarding" };

export default async function ConsultantOnboardingPage() {
  const user = await requireUser();
  const [profile, agreement] = await Promise.all([
    db.consultantProfile.findUnique({ where: { userId: user.id } }),
    db.contentPage.findFirst({
      where: { kind: "agreement_consultant", isPublished: true },
      orderBy: { version: "desc" },
      select: { slug: true, title: true },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Professional onboarding"
        subtitle="We follow IRS-standard onboarding for tax professionals: credentials, PTIN, proof, and business details."
      />
      <ConsultantOnboardingForm
        existing={
          profile
            ? {
                credentialType: profile.credentialType,
                credentialNumber: profile.credentialNumber,
                ptin: profile.ptin,
                isBusiness: profile.isBusiness,
                businessName: profile.businessName,
                ein: profile.ein,
                statesServed: profile.statesServed,
                yearsExperience: profile.yearsExperience,
                specialties: JSON.parse(profile.specialties || "[]"),
              }
            : null
        }
        agreementSlug={agreement?.slug ?? ""}
        agreementTitle={agreement?.title ?? "Consultant Agreement"}
      />
    </div>
  );
}
