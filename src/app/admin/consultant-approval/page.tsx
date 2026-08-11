import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { APPROVAL_CRITERIA, getRequiredCriteria } from "@/lib/consultant-criteria";
import { getBoolSetting, getNumberSetting } from "@/lib/settings";
import { ApprovalCriteriaForm } from "@/components/admin/approval-criteria-form";

export const metadata = { title: "CPA automated approval" };

export default async function ConsultantApprovalPage() {
  await guardAdminPage("admin.consultants");
  const [enabled, required, minYears] = await Promise.all([
    getBoolSetting("consultants.auto_approve_enabled", false),
    getRequiredCriteria(),
    getNumberSetting("consultants.auto_approve_min_years", 3),
  ]);

  return (
    <div>
      <PageHeader
        title="CPA / Consultant automated approval"
        subtitle="Choose which credentialing criteria an application must satisfy to be approved automatically. Applications missing any required criterion go to manual review."
      />
      <div className="mb-6 flex items-center gap-2">
        <Badge color={enabled ? "green" : "slate"}>{enabled ? "Automated approval ON" : "Automated approval OFF — all applications reviewed manually"}</Badge>
        <Badge>{required.length} required criteria</Badge>
      </div>
      <Card>
        <CardBody>
          <ApprovalCriteriaForm
            criteria={APPROVAL_CRITERIA.map((c) => ({ key: c.key, name: c.name, description: c.description, hasValue: c.hasValue ?? false }))}
            enabled={enabled}
            required={required}
            minYears={minYears}
          />
        </CardBody>
      </Card>
      <p className="mt-4 text-xs text-slate-400">
        Criteria reflect IRS requirements and practice for paid tax professionals: PTIN (required for all paid preparers),
        state CPA licensure / IRS EA enrollment under Circular 230, EFIN suitability for e-file providers, identity proofing,
        and compliance attestation. The consultant onboarding form collects all of these, including document uploads.
      </p>
    </div>
  );
}
