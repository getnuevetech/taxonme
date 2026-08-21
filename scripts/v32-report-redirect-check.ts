import Module from "node:module";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function setPlanReportLimit(planKey: string, limit: number) {
  const db = (await import("../src/lib/db")).db;
  const plan = await db.subscriptionPlan.findUnique({ where: { key: planKey } });
  assert.ok(plan, `${planKey} plan must exist`);
  await db.planFeature.upsert({
    where: { planId_featureKey: { planId: plan.id, featureKey: "case.report" } },
    update: { enabled: true, limitValue: limit },
    create: { planId: plan.id, featureKey: "case.report", enabled: true, limitValue: limit },
  });
  return plan;
}

async function main() {
  const db = (await import("../src/lib/db")).db;
  const { FEATURE_KEYS, PAYMENT_KINDS, SETTINGS } = await import("../src/lib/constants");
  const { sameOriginRedirect } = await import("../src/lib/http");
  const { consumeCaseReportDownload, extraCaseReportFeeCents, getCaseReportAccess } = await import("../src/lib/case-report-quota");

  const email = `report-quota-${Date.now()}@example.com`;
  let userId: string | null = null;
  const caseIds: string[] = [];
  const createdSubs: string[] = [];
  const previousFee = await db.setting.findUnique({ where: { key: SETTINGS.CASE_REPORT_EXTRA_CENTS } });

  try {
    await setPlanReportLimit("free", 1);
    await setPlanReportLimit("plus", 3);
    await setPlanReportLimit("pro", 7);
    await db.setting.upsert({
      where: { key: SETTINGS.CASE_REPORT_EXTRA_CENTS },
      update: { value: "499", type: "number", group: "billing" },
      create: {
        key: SETTINGS.CASE_REPORT_EXTRA_CENTS,
        value: "499",
        type: "number",
        group: "billing",
        label: "Extra case report download fee (cents)",
      },
    });

    const user = await db.user.create({ data: { email, role: "user", status: "active" } });
    userId = user.id;
    for (let i = 0; i < 4; i++) {
      const c = await db.case.create({
        data: { userId: user.id, title: `Quota case ${i + 1}`, situation: "I owe for 2023.", goal: "Print the report.", status: "analyzed" },
      });
      caseIds.push(c.id);
    }

    assert.equal(await extraCaseReportFeeCents(), 499, "admin extra-download fee defaults to $4.99");

    const freeAccess = await getCaseReportAccess(user, caseIds[0]);
    assert.equal(freeAccess.includedLimit, 1, "Free includes 1 case report download");
    assert.equal(freeAccess.remaining, 1);
    assert.equal(freeAccess.allowed, true);
    assert.equal(freeAccess.paywall, false);
    assert.equal(await consumeCaseReportDownload(user.id, caseIds[0]), "ok");
    assert.equal(await consumeCaseReportDownload(user.id, caseIds[0]), "ok", "re-opening the same case does not consume another unit");

    const second = await getCaseReportAccess(user, caseIds[1]);
    assert.equal(second.allowed, false, "Free's second unique case requires an extra download");
    assert.equal(second.paywall, true);
    assert.equal(second.quotaRedirect, `/app/cases/${caseIds[1]}?report_quota=1`);
    assert.equal(await consumeCaseReportDownload(user.id, caseIds[1]), "payment_required");

    await db.paymentTransaction.create({
      data: { userId: user.id, amountCents: 499, gateway: "manual", status: "succeeded", kind: PAYMENT_KINDS.CASE_REPORT_EXTRA },
    });
    const afterPay = await getCaseReportAccess(user, caseIds[1]);
    assert.equal(afterPay.allowed, true, "a succeeded extra-download payment unlocks one more unique case");
    assert.equal(await consumeCaseReportDownload(user.id, caseIds[1]), "ok");

    const plus = await db.subscriptionPlan.findUnique({ where: { key: "plus" } });
    assert.ok(plus);
    const plusSub = await db.subscription.create({ data: { userId: user.id, planId: plus.id, status: "active" } });
    createdSubs.push(plusSub.id);
    // Two unique cases already consumed (free 1 + extra 1). Plus allowance is 3, plus 1 extra purchased = 4 capacity.
    const plusAccess = await getCaseReportAccess(user, caseIds[2]);
    assert.equal(plusAccess.includedLimit, 3, "Plus includes 3 case report downloads");
    assert.equal(plusAccess.remaining, 2, "Plus remaining is included + extras − unique cases already retrieved");
    assert.equal(plusAccess.allowed, true);

    const pro = await db.subscriptionPlan.findUnique({ where: { key: "pro" } });
    assert.ok(pro);
    await db.subscription.update({ where: { id: plusSub.id }, data: { status: "canceled", canceledAt: new Date() } });
    const proSub = await db.subscription.create({ data: { userId: user.id, planId: pro.id, status: "active" } });
    createdSubs.push(proSub.id);
    const proAccess = await getCaseReportAccess(user, caseIds[2]);
    assert.equal(proAccess.includedLimit, 7, "Pro includes 7 case report downloads");
    assert.ok((proAccess.remaining ?? 0) >= 5);

    const redirected = sameOriginRedirect(`/app/cases/${caseIds[1]}?report_quota=1`);
    assert.equal(redirected.headers.get("Location"), `/app/cases/${caseIds[1]}?report_quota=1`);
    assert.notEqual(redirected.headers.get("Location")?.includes("localhost"), true);

    const casePage = readFileSync("src/app/app/cases/[id]/page.tsx", "utf8");
    assert.doesNotMatch(casePage, /Re-run analysis/);
    assert.doesNotMatch(readFileSync("src/components/case-analysis-view.tsx", "utf8"), /Re-run the analysis now/);
    assert.match(readFileSync("src/app/admin/plans/page.tsx", "utf8"), /CaseReportExtraFeeForm/);
    assert.match(readFileSync("src/app/api/webhooks/stripe/route.ts", "utf8"), /CASE_REPORT_EXTRA/);
    assert.ok(FEATURE_KEYS.CASE_REPORT);

    console.log("case report quota check passed — Free 1 / Plus 3 / Pro 7, extras charged, same-case reopen free, re-run CTA gone");
  } finally {
    if (previousFee) {
      await db.setting.update({ where: { key: SETTINGS.CASE_REPORT_EXTRA_CENTS }, data: { value: previousFee.value } }).catch(() => undefined);
    }
    for (const id of createdSubs) await db.subscription.delete({ where: { id } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
