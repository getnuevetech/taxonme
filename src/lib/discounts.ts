import "server-only";
import { db } from "./db";

// Admin-managed subscription discounts. General discounts apply to everyone;
// targeted discounts apply only to specific emails. The best active discount
// per plan wins, and customers always see the sale on the plan pickers.

export type ActiveDiscount = {
  id: string;
  name: string;
  percentOff: number;
  amountOffCents: number;
};

function isLive(d: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }): boolean {
  const now = Date.now();
  if (!d.isActive) return false;
  if (d.startsAt && d.startsAt.getTime() > now) return false;
  if (d.endsAt && d.endsAt.getTime() < now) return false;
  return true;
}

function appliesTo(d: { audience: string; emailsJson: string }, email: string | null): boolean {
  if (d.audience !== "specific") return true;
  if (!email) return false;
  try {
    const emails = JSON.parse(d.emailsJson || "[]");
    return Array.isArray(emails) && emails.some((e) => String(e).toLowerCase().trim() === email.toLowerCase());
  } catch {
    return false;
  }
}

export function applyDiscount(cents: number, d: ActiveDiscount | null | undefined): number {
  if (!d || cents <= 0) return cents;
  const off = d.percentOff > 0 ? Math.round((cents * d.percentOff) / 100) : d.amountOffCents;
  return Math.max(0, cents - off);
}

/** Best active discount per plan for this viewer (guest = general only). */
export async function getPlanDiscounts(
  planIds: string[],
  email: string | null,
): Promise<Record<string, ActiveDiscount>> {
  if (planIds.length === 0) return {};
  const rows = await db.planDiscount.findMany({ where: { planId: { in: planIds } } });
  const best: Record<string, ActiveDiscount> = {};
  for (const d of rows) {
    if (!isLive(d) || !appliesTo(d, email)) continue;
    const current = best[d.planId];
    // Compare by savings on a reference price of $100 to rank percent vs fixed.
    const value = (x: { percentOff: number; amountOffCents: number }) =>
      x.percentOff > 0 ? x.percentOff * 100 : x.amountOffCents;
    if (!current || value(d) > value(current)) {
      best[d.planId] = { id: d.id, name: d.name, percentOff: d.percentOff, amountOffCents: d.amountOffCents };
    }
  }
  return best;
}

export async function getDiscountForPlan(planId: string, email: string | null): Promise<ActiveDiscount | null> {
  const map = await getPlanDiscounts([planId], email);
  return map[planId] ?? null;
}
