import Module from "node:module";
import assert from "node:assert";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const db = (await import("../src/lib/db")).db;
  const { hasFeature } = await import("../src/lib/access");
  const { FEATURE_KEYS } = await import("../src/lib/constants");
  const { sameOriginRedirect } = await import("../src/lib/http");
  const { buildCaseReportHtml } = await import("../src/lib/case-report");

  const email = `report-redirect-${Date.now()}@example.com`;
  let userId: string | null = null;
  let subscriptionId: string | null = null;
  try {
    const user = await db.user.create({ data: { email, role: "user", status: "active" } });
    userId = user.id;
    const c = await db.case.create({
      data: { userId: user.id, title: "Report redirect check", situation: "I owe for 2023.", goal: "Print the report.", status: "analyzed" },
    });

    assert.equal(await hasFeature(user.id, FEATURE_KEYS.CASE_REPORT), false, "the free plan must not include the printable report");

    const plus = await db.subscriptionPlan.findUnique({ where: { key: "plus" } });
    assert.ok(plus, "Plus plan must exist");
    const plusReport = await db.planFeature.findUnique({
      where: { planId_featureKey: { planId: plus.id, featureKey: FEATURE_KEYS.CASE_REPORT } },
    });
    assert.equal(plusReport?.enabled, true, "Plus must include the printable report — it is the print view of analysis Plus already includes");

    const sub = await db.subscription.create({
      data: { userId: user.id, planId: plus.id, status: "active" },
    });
    subscriptionId = sub.id;
    assert.equal(await hasFeature(user.id, FEATURE_KEYS.CASE_REPORT), true, "a Plus subscriber must be able to open the report");

    const report = await buildCaseReportHtml(c.id);
    assert.ok(report?.html.includes("Case Report"), "the report must actually render for an entitled case");
    assert.match(report!.fileName, /case-report/);

    const redirected = sameOriginRedirect("/app/billing?upgrade=report");
    assert.equal(redirected.headers.get("Location"), "/app/billing?upgrade=report");
    assert.notEqual(redirected.headers.get("Location")?.includes("localhost"), true);

    console.log("case report redirect check passed — free denied, plus entitled, billing Location is host-relative");
  } finally {
    if (subscriptionId) await db.subscription.delete({ where: { id: subscriptionId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
