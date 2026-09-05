/**
 * Package B — compress customer-facing unknowns into ≤2 understandable groups.
 * Full CaseUnknown ledger remains available internally.
 */

export type UnknownGroupId = "account_position" | "irs_communication" | "other";

export type UnknownGroup = {
  id: UnknownGroupId;
  title: string;
  summary: string;
  items: string[];
};

const ACCOUNT_RE =
  /(balance|amount|owe|tax year|tax period|payment|credit|penalt|interest|principal|composition|account)/i;
const NOTICE_RE = /(notice|letter|correspondence|deadline|respond by|cp\d+|lt\d+|ltr)/i;

export function classifyUnknownLabel(label: string): UnknownGroupId {
  if (NOTICE_RE.test(label)) return "irs_communication";
  if (ACCOUNT_RE.test(label)) return "account_position";
  return "other";
}

export function groupCustomerUnknowns(
  unknowns: { key?: string; label: string; text?: string }[],
): UnknownGroup[] {
  const buckets: Record<UnknownGroupId, string[]> = {
    account_position: [],
    irs_communication: [],
    other: [],
  };
  for (const u of unknowns) {
    const label = (u.label || u.text || "").trim();
    if (!label) continue;
    const id = classifyUnknownLabel(label);
    if (!buckets[id].includes(label)) buckets[id].push(label);
  }

  const groups: UnknownGroup[] = [];
  if (buckets.account_position.length) {
    groups.push({
      id: "account_position",
      title: "Your IRS account position",
      summary:
        "We need to identify the tax period, current balance, payments/credits, and any penalties or interest.",
      items: buckets.account_position,
    });
  }
  if (buckets.irs_communication.length) {
    groups.push({
      id: "irs_communication",
      title: "The IRS communication",
      summary: "Your notice can tell us what action the IRS is taking and whether there is a deadline.",
      items: buckets.irs_communication,
    });
  }
  if (buckets.other.length && groups.length < 2) {
    groups.push({
      id: "other",
      title: "Other facts still needed",
      summary: buckets.other.slice(0, 2).join(" · "),
      items: buckets.other,
    });
  }
  return groups.slice(0, 2);
}
