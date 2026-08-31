/**
 * Wave 5 — Prep Plan builder (tax analogue of Imm Filing Plan).
 * Created only when the customer chooses to pursue a pathway. Never a Case.
 */

export type PrepPlanContent = {
  selectedPathway: string;
  pathwayLabel: string;
  eligibility: {
    summary: string;
    requirements: string[];
  };
  blockers: string[];
  filings: { form: string; role: string; notes: string }[];
  evidenceNeeds: string[];
  sequence: string[];
  preparationStatus: "draft" | "in_progress" | "ready" | "filed";
  consultantHint: string;
  selfFileHint: string;
};

type PathwayHint = { id: string; condition?: string; explanation?: string };

const INSTALLMENT: PrepPlanContent = {
  selectedPathway: "installment_agreement",
  pathwayLabel: "IRS installment agreement",
  eligibility: {
    summary:
      "Many taxpayers who owe a balance can request a monthly payment plan (often Form 9465). Streamlined options may apply under common balance thresholds — confirm against your transcript balance and ability to pay.",
    requirements: [
      "Confirmed balance due on IRS account transcript for the years at issue",
      "Ability to propose a realistic monthly payment",
      "You are not in a status that blocks installment agreements (confirm for your facts)",
    ],
  },
  blockers: [
    "Missing or outdated balance information can lead to the wrong payment amount",
    "Active levy or lien issues may need concurrent collection relief",
    "Inability to pay even a minimal monthly amount may point to CNC or other relief instead",
  ],
  filings: [
    { form: "9465", role: "Installment Agreement Request", notes: "Primary request for a monthly payment plan" },
    { form: "433-F / 433-A", role: "Financial statement (if requested)", notes: "May be required for larger balances or non-streamlined paths" },
  ],
  evidenceNeeds: [
    "IRS Account Transcript for each tax year with a balance",
    "Recent wage or income evidence if a financial statement is needed",
    "Bank statements if the IRS requests ability-to-pay documentation",
    "Copy of any collection notices (CP503, LT11, etc.) already received",
  ],
  sequence: [
    "Confirm balance and tax years from transcript",
    "Decide installment vs CNC vs OIC based on ability to pay",
    "Prepare Form 9465 (and financial statement if needed)",
    "Consultant review recommended for levy risk or complex balances",
    "Submit to IRS; once filed / pending → track as an agency Case",
  ],
  preparationStatus: "draft",
  consultantHint: "Talk to a CPA/EA before filing if levy risk, joint liability, or large balances are involved.",
  selfFileHint: "If you file yourself, follow current IRS Form 9465 instructions — this plan is guidance, not a filed Case.",
};

const CNC: PrepPlanContent = {
  selectedPathway: "currently_not_collectible",
  pathwayLabel: "Currently Not Collectible (CNC) hardship status",
  eligibility: {
    summary:
      "If you cannot pay basic living expenses and still pay the IRS, Currently Not Collectible status may pause active collection. It does not erase the debt; interest and penalties may continue.",
    requirements: [
      "Documented inability to pay after allowable living expenses",
      "Complete financial disclosure when the IRS requests it",
      "Accurate account balances and tax years",
    ],
  },
  blockers: [
    "CNC is temporary — the IRS may revisit your finances later",
    "Incomplete Form 433 packages often delay or deny hardship status",
    "Levy notices with short deadlines may need parallel urgency steps",
  ],
  filings: [
    { form: "433-F / 433-A", role: "Collection Information Statement", notes: "Shows income, expenses, and assets" },
    { form: "CNC request", role: "Hardship / CNC request", notes: "Usually submitted with the financial statement to Collections" },
  ],
  evidenceNeeds: [
    "Pay stubs or income proof",
    "Rent/mortgage and essential expense documentation",
    "Bank statements",
    "IRS transcripts showing the balance",
  ],
  sequence: [
    "Confirm you cannot sustain an installment payment after expenses",
    "Assemble Form 433 package with supporting docs",
    "Professional review strongly recommended for levy urgency",
    "Submit to Collections; track the matter as a Case once pending with the IRS",
  ],
  preparationStatus: "draft",
  consultantHint: "Hardship and levy timing are high-stakes — a CPA/EA review is strongly recommended.",
  selfFileHint: "Do not ignore levy deadlines based only on this plan. Confirm with current IRS guidance or a professional.",
};

const OIC: PrepPlanContent = {
  selectedPathway: "offer_in_compromise",
  pathwayLabel: "Offer in Compromise (OIC)",
  eligibility: {
    summary:
      "An Offer in Compromise lets some taxpayers settle for less than the full balance when they qualify under IRS rules (doubt as to collectibility, doubt as to liability, or effective tax administration). Acceptance rates are selective — confirm eligibility before paying the application fee.",
    requirements: [
      "You meet IRS OIC qualification rules for your facts",
      "Complete Form 656 package and required financial disclosure",
      "Application fee and initial payment rules as currently published by the IRS",
    ],
  },
  blockers: [
    "Open bankruptcies or incomplete returns can block consideration",
    "Understating income or assets leads to rejection",
    "OIC is not a shortcut when installment or CNC better fits the facts",
  ],
  filings: [
    { form: "656", role: "Offer in Compromise", notes: "Primary offer form" },
    { form: "433-A (OIC) / 433-B", role: "Financial statement for OIC", notes: "Required with most offers" },
  ],
  evidenceNeeds: [
    "Full financial disclosure package",
    "Tax returns for required years",
    "Asset and bank documentation",
    "IRS transcripts",
  ],
  sequence: [
    "Screen eligibility with current IRS OIC criteria",
    "Build Form 656 + 433 package",
    "Professional review strongly recommended before paying fees",
    "Submit offer; track as a Case once the IRS opens the matter",
  ],
  preparationStatus: "draft",
  consultantHint: "OIC packages are detailed — professional preparation often improves completeness.",
  selfFileHint: "Use official IRS OIC instructions and the pre-qualifier tool before applying.",
};

const PENALTY: PrepPlanContent = {
  selectedPathway: "penalty_abatement",
  pathwayLabel: "Penalty abatement / first-time abatement",
  eligibility: {
    summary:
      "You may request removal of certain failure-to-file or failure-to-pay penalties when you qualify for first-time abatement or reasonable cause. Tax itself usually still remains due.",
    requirements: [
      "Identify which penalties appear on the transcript",
      "Confirm first-time abatement eligibility or document reasonable cause",
      "File a written request or use IRS procedures that apply to your notice",
    ],
  },
  blockers: [
    "Abatement does not always reduce the underlying tax",
    "Missing the response window on a notice can limit options",
    "Reasonable-cause claims need specific facts, not generic statements",
  ],
  filings: [
    { form: "843", role: "Claim for Refund and Request for Abatement", notes: "Common written abatement vehicle when applicable" },
    { form: "Written request", role: "Penalty abatement letter", notes: "Sometimes accepted without Form 843 depending on the penalty type" },
  ],
  evidenceNeeds: [
    "Account transcript showing penalty codes",
    "Proof supporting first-time or reasonable-cause facts",
    "Copy of the notice assessing the penalty",
  ],
  sequence: [
    "Confirm penalty types and amounts on transcript",
    "Choose first-time vs reasonable-cause path",
    "Draft request / Form 843",
    "Submit; track IRS response as a Case if a matter is opened",
  ],
  preparationStatus: "draft",
  consultantHint: "Connect with a tax professional when penalties are large or mixed with collection action.",
  selfFileHint: "Follow current IRS penalty relief guidance for the specific penalty codes on your transcript.",
};

const GENERIC: PrepPlanContent = {
  selectedPathway: "general_tax_path",
  pathwayLabel: "Tax path preparation",
  eligibility: {
    summary:
      "A structured plan to pursue the pathway discussed in your Situation — still not an agency Case until something is filed or pending with the IRS or another tax agency.",
    requirements: [
      "Confirm the pathway that fits your facts",
      "Identify eligibility requirements for that pathway",
      "Gather required evidence before filing",
    ],
  },
  blockers: [
    "Unresolved decision-changing facts (for example ability to pay)",
    "Missing transcripts or notices",
  ],
  filings: [
    { form: "TBD", role: "Primary filing for the selected pathway", notes: "Confirm the correct form after the controlling facts are known" },
  ],
  evidenceNeeds: [
    "IRS Account Transcript(s)",
    "Copies of any notices you received",
    "Income and expense records if collection relief is involved",
  ],
  sequence: [
    "Resolve controlling unknowns from your Situation",
    "Confirm pathway and forms",
    "Gather evidence",
    "Consultant review or self-file preparation",
    "File → then track as a Case if an agency matter exists",
  ],
  preparationStatus: "draft",
  consultantHint: "Connect with a CPA or Enrolled Agent when you are ready for review.",
  selfFileHint: "Use official IRS form instructions for any form you prepare.",
};

export function buildPrepPlanContent(opts: {
  selectedPathway?: string | null;
  pathways?: PathwayHint[];
  narrative?: string;
}): PrepPlanContent {
  const selected =
    opts.selectedPathway ||
    opts.pathways?.[0]?.id ||
    inferPathwayFromNarrative(opts.narrative ?? "");

  if (selected === "installment_agreement" || selected === "payment_plan") {
    return { ...INSTALLMENT, selectedPathway: "installment_agreement" };
  }
  if (selected === "currently_not_collectible" || selected === "cnc" || selected === "hardship") {
    return { ...CNC, selectedPathway: "currently_not_collectible" };
  }
  if (selected === "offer_in_compromise" || selected === "oic") {
    return { ...OIC, selectedPathway: "offer_in_compromise" };
  }
  if (selected === "penalty_abatement" || selected === "first_time_abatement") {
    return { ...PENALTY, selectedPathway: "penalty_abatement" };
  }

  const fromBranch = opts.pathways?.find((p) => p.id === selected);
  if (fromBranch) {
    return {
      ...GENERIC,
      selectedPathway: fromBranch.id,
      pathwayLabel: fromBranch.condition || GENERIC.pathwayLabel,
      eligibility: {
        summary: fromBranch.explanation || GENERIC.eligibility.summary,
        requirements: GENERIC.eligibility.requirements,
      },
    };
  }

  return { ...GENERIC, selectedPathway: selected || GENERIC.selectedPathway };
}

function inferPathwayFromNarrative(text: string): string {
  if (/\b(offer in compromise|oic)\b/i.test(text)) return "offer_in_compromise";
  if (/\b(currently not collectible|cnc|hardship|can'?t pay.*expense)\b/i.test(text)) {
    return "currently_not_collectible";
  }
  if (/\b(penalty|abatement|first.?time)\b/i.test(text)) return "penalty_abatement";
  if (/\b(installment|payment plan|9465|can'?t pay|owe|balance due)\b/i.test(text)) {
    return "installment_agreement";
  }
  return "general_tax_path";
}

export function parsePathwaysJson(raw: string): PathwayHint[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p: PathwayHint) => ({
        id: String(p.id || ""),
        condition: p.condition ? String(p.condition) : undefined,
        explanation: p.explanation ? String(p.explanation) : undefined,
      }))
      .filter((p) => p.id);
  } catch {
    return [];
  }
}
