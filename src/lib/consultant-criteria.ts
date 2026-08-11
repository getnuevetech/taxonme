import "server-only";
import { getSetting, getNumberSetting, getBoolSetting } from "./settings";

// Automated-approval criteria for CPA / Tax Consultant applications, based on
// what the IRS requires or expects of paid tax professionals. The admin
// chooses which of these are REQUIRED for automated approval; applications
// meeting every required criterion are approved without manual review.

export type CriterionDef = {
  key: string;
  name: string;
  description: string;
  hasValue?: boolean; // criterion with a configurable threshold (e.g. minimum years)
};

export const APPROVAL_CRITERIA: CriterionDef[] = [
  {
    key: "credential",
    name: "Verified professional credential (CPA or EA)",
    description:
      "Applicant is a state-licensed CPA (license number + state of licensure) or an IRS Enrolled Agent (enrollment number). EAs are credentialed directly by the IRS under Circular 230; CPAs by their state board of accountancy.",
  },
  {
    key: "ptin",
    name: "PTIN provided",
    description:
      "IRS Preparer Tax Identification Number. The IRS requires anyone who prepares or substantially helps prepare federal tax returns for compensation to hold a current PTIN.",
  },
  {
    key: "proof",
    name: "Credential document uploaded",
    description: "A copy of the CPA license certificate or IRS EA enrollment card is attached to the application.",
  },
  {
    key: "photo_id",
    name: "Government-issued photo ID uploaded",
    description: "Identity verification document (driver's license, passport, or state ID), consistent with IRS e-Services identity-proofing practice.",
  },
  {
    key: "insurance",
    name: "Professional liability (E&O) insurance proof uploaded",
    description: "Evidence of current errors-and-omissions coverage — standard practice for professionals handling client tax matters.",
  },
  {
    key: "efin",
    name: "EFIN provided",
    description:
      "IRS Electronic Filing Identification Number, issued after the IRS e-file provider application (which includes an IRS suitability check). Relevant for consultants who e-file for clients.",
  },
  {
    key: "ein",
    name: "Business EIN provided (business accounts)",
    description: "Firms/practices must supply their Employer Identification Number. Automatically satisfied for individual (non-business) applicants.",
  },
  {
    key: "states",
    name: "States served declared",
    description: "The applicant listed the states in which they serve clients.",
  },
  {
    key: "min_years",
    name: "Minimum years of experience",
    description: "Years of professional tax experience meets or exceeds the configured minimum.",
    hasValue: true,
  },
  {
    key: "attestation",
    name: "Compliance attestation accepted",
    description:
      "Applicant attests they are compliant with their own federal tax obligations and have no disqualifying offenses — mirroring the IRS suitability standards applied to e-file providers and enrolled practitioners.",
  },
];

export type ApplicationFacts = {
  credentialType: string;
  credentialNumber: string;
  licenseState: string;
  ptin: string;
  efin: string;
  proofDocumentPath: string;
  photoIdPath: string;
  insurancePath: string;
  isBusiness: boolean;
  ein: string;
  statesServed: string;
  yearsExperience: number;
  attestedCompliance: boolean;
};

export function criterionSatisfied(key: string, f: ApplicationFacts, minYears: number): boolean {
  switch (key) {
    case "credential":
      return (f.credentialType === "cpa" || f.credentialType === "ea") && !!f.credentialNumber && (f.credentialType === "ea" || !!f.licenseState);
    case "ptin":
      return f.ptin.trim().length > 0;
    case "proof":
      return !!f.proofDocumentPath;
    case "photo_id":
      return !!f.photoIdPath;
    case "insurance":
      return !!f.insurancePath;
    case "efin":
      return f.efin.trim().length > 0;
    case "ein":
      return !f.isBusiness || !!f.ein.trim();
    case "states":
      return f.statesServed.trim().length > 0;
    case "min_years":
      return f.yearsExperience >= minYears;
    case "attestation":
      return f.attestedCompliance;
    default:
      return false;
  }
}

export async function getRequiredCriteria(): Promise<string[]> {
  const raw = await getSetting("consultants.auto_criteria", '["credential","ptin","proof","min_years","attestation"]');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Evaluates an application against the admin-required criteria.
// Returns qualification plus the per-criterion breakdown (for admin review).
export async function evaluateAutoApproval(f: ApplicationFacts): Promise<{
  enabled: boolean;
  qualifies: boolean;
  results: { key: string; name: string; required: boolean; satisfied: boolean }[];
}> {
  const [enabled, required, minYears] = await Promise.all([
    getBoolSetting("consultants.auto_approve_enabled", false),
    getRequiredCriteria(),
    getNumberSetting("consultants.auto_approve_min_years", 3),
  ]);
  const results = APPROVAL_CRITERIA.map((c) => ({
    key: c.key,
    name: c.name,
    required: required.includes(c.key),
    satisfied: criterionSatisfied(c.key, f, minYears),
  }));
  const qualifies = enabled && required.length > 0 && results.every((r) => !r.required || r.satisfied);
  return { enabled, qualifies, results };
}
