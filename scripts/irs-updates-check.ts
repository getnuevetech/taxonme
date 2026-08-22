import Module from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const { parseAgencyFeedXml, parseIrsNewsroomHtml, slugifyUpdateTitle } = await import("../src/lib/agency-updates/parse");
  const db = (await import("../src/lib/db")).db;
  const { FEATURE_KEYS } = await import("../src/lib/constants");
  const { userCanSeeCaseImpact, analyzeUpdateImpactForCase } = await import("../src/lib/agency-updates/impact");
  const { syncAgencyUpdates } = await import("../src/lib/agency-updates/sync");

  const rss = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <item>
      <title><![CDATA[Interest rates remain the same for the fourth quarter of 2026]]></title>
      <link>https://www.irs.gov/newsroom/interest-rates-remain-the-same-for-the-fourth-quarter-of-2026</link>
      <guid>IR-2026-98</guid>
      <pubDate>Fri, 21 Aug 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[IR-2026-98, Aug. 21, 2026 — The IRS announced that interest rates will remain the same for the calendar quarter beginning Oct. 1, 2026.]]></description>
    </item>
    <item>
      <title>IRS launches digitally authenticated tax compliance report</title>
      <link>https://www.irs.gov/newsroom/irs-launches-digitally-authenticated-tax-compliance-report</link>
      <guid>IR-2026-97</guid>
      <description>The IRS announced a digitally authenticated tax compliance report.</description>
      <pubDate>Thu, 20 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel></rss>`;
  const parsed = parseAgencyFeedXml(rss);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "Interest rates remain the same for the fourth quarter of 2026");
  assert.match(parsed[0].sourceUrl, /interest-rates/);
  assert.ok(slugifyUpdateTitle(parsed[0].title, parsed[0].externalId).includes("interest-rates"));

  const html = `
    <html><body>
      <h2><a href="/newsroom/interest-rates-remain-the-same-for-the-fourth-quarter-of-2026"><span>Interest rates remain the same for the fourth quarter of 2026</span></a></h2>
      <div class="field__item">IR-2026-98, Aug. 21, 2026 — The IRS announced that interest rates will remain the same for the calendar quarter beginning Oct. 1, 2026.</div>
      <h2><a href="/newsroom/irs-launches-digitally-authenticated-tax-compliance-report"><span>IRS launches digitally authenticated tax compliance report</span></a></h2>
      <div class="field__item">IR-2026-97, Aug. 20, 2026 — The IRS announced a digitally authenticated tax compliance report for taxpayers and practitioners.</div>
      <a href="/newsroom">Newsroom</a>
    </body></html>`;
  const scraped = parseIrsNewsroomHtml(html, "https://www.irs.gov/newsroom/news-releases-for-current-month");
  assert.ok(scraped.length >= 2);
  assert.ok(scraped.some((i) => /interest rates/i.test(i.title)));
  assert.ok(scraped.some((i) => i.externalId === "IR-2026-98"));

  // Static surface checks.
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /UpdatesSection/);
  assert.match(readFileSync("src/app/irs-updates/page.tsx", "utf8"), /listPublishedUpdatesForListing/);
  assert.match(readFileSync("src/app/irs-updates/[slug]/page.tsx", "utf8"), /CaseImpactPanel/);
  assert.match(readFileSync("src/app/app/irs-updates/page.tsx", "utf8"), /userCanSeeCaseImpact/);
  assert.match(readFileSync("src/components/site-nav.tsx", "utf8"), /\/irs-updates/);
  assert.match(readFileSync("src/components/updates-section.tsx", "utf8"), /variant/);
  assert.doesNotMatch(readFileSync("src/components/updates-section.tsx", "utf8"), /Fresh notices and news from/);
  assert.match(readFileSync("next.config.ts", "utf8"), /destination: "\/irs-updates"/);
  assert.match(readFileSync("src/app/api/cron/maintenance/route.ts", "utf8"), /syncAgencyUpdates/);
  assert.match(readFileSync("src/app/api/cron/maintenance/route.ts", "utf8"), /irsSync/);
  assert.match(readFileSync("prisma/seed.ts", "utf8"), /updates\.case_impact/);
  assert.match(readFileSync("prisma/seed.ts", "utf8"), /seedIrsUpdates/);
  assert.match(readFileSync("src/lib/constants.ts", "utf8"), /IRS_ALERTS_URL/);
  assert.doesNotMatch(readFileSync("src/lib/constants.ts", "utf8"), /USCIS_/);
  assert.doesNotMatch(readFileSync("src/lib/agency-updates/parse.ts", "utf8"), /parseUscis/);

  const {
    irsNewsroomUrlsForRollingWeeks,
    irsMonthNewsroomUrl,
    startOfRollingTwoWeeks,
    IRS_UPDATES_MIN_LOOKBACK_DAYS,
  } = await import("../src/lib/agency-updates/sync");
  assert.equal(IRS_UPDATES_MIN_LOOKBACK_DAYS, 14);
  const urls = irsNewsroomUrlsForRollingWeeks("https://www.irs.gov/newsroom/news-releases-for-current-month", new Date("2026-08-22T12:00:00Z"));
  assert.ok(urls.some((u) => /current-month/.test(u)));
  assert.ok(urls.some((u) => u === irsMonthNewsroomUrl(new Date("2026-07-01T00:00:00Z"))));
  assert.match(irsMonthNewsroomUrl(new Date("2026-07-15T00:00:00Z")), /news-releases-for-july-2026/);
  const since = startOfRollingTwoWeeks(new Date("2026-08-22T12:00:00Z"));
  assert.ok(since < new Date("2026-08-22T12:00:00Z"));

  const email = `irs-updates-${Date.now()}@example.com`;
  let userId: string | null = null;
  let updateId: string | null = null;
  let caseId: string | null = null;
  let subId: string | null = null;
  try {
    const user = await db.user.create({ data: { email, role: "user", status: "active", firstName: "Ava" } });
    userId = user.id;
    assert.equal(await userCanSeeCaseImpact(user.id), false, "free users do not get case-impact analysis");

    const update = await db.agencyUpdate.create({
      data: {
        slug: `test-interest-${Date.now()}`,
        title: "Interest rates remain the same for the fourth quarter of 2026",
        summary: "IR-2026-98 — Interest rates remain unchanged for Q4 2026.",
        body: "The IRS announced that underpayment and overpayment interest rates remain the same for the calendar quarter beginning Oct. 1, 2026.",
        sourceAgency: "IRS",
        externalId: `test:${Date.now()}`,
        sourceUrl: "https://www.irs.gov/newsroom/news-releases-for-current-month",
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    updateId = update.id;

    const c = await db.case.create({
      data: {
        userId: user.id,
        title: "Balance due with accruing interest",
        situation: "I owe a balance on my 2024 return and interest keeps adding each quarter.",
        goal: "Understand whether the Q4 interest rate change affects what I owe.",
        status: "analyzed",
      },
    });
    caseId = c.id;

    const denied = await analyzeUpdateImpactForCase({ userId: user.id, caseId: c.id, updateId: update.id });
    assert.equal(denied, null, "impact analysis must stay gated before Plus/Pro");

    const plus = await db.subscriptionPlan.findUnique({ where: { key: "plus" } });
    assert.ok(plus);
    await db.planFeature.upsert({
      where: { planId_featureKey: { planId: plus.id, featureKey: FEATURE_KEYS.UPDATES_CASE_IMPACT } },
      update: { enabled: true },
      create: { planId: plus.id, featureKey: FEATURE_KEYS.UPDATES_CASE_IMPACT, enabled: true },
    });
    const sub = await db.subscription.create({ data: { userId: user.id, planId: plus.id, status: "active" } });
    subId = sub.id;
    assert.equal(await userCanSeeCaseImpact(user.id), true, "Plus unlocks case-impact analysis");

    const impact = await analyzeUpdateImpactForCase({ userId: user.id, caseId: c.id, updateId: update.id });
    assert.ok(impact);
    assert.ok(["high", "medium", "low", "none", "unknown"].includes(impact!.relevance));
    assert.ok(impact!.summary.length > 10);

    const sync = await syncAgencyUpdates();
    assert.ok(["rss", "html", "none"].includes(sync.source));
    // Live IRS newsroom is preferred; HTML scrape or seeded/manual rows are both acceptable.
    const published = await db.agencyUpdate.count({ where: { isPublished: true, sourceAgency: "IRS" } });
    assert.ok(published >= 1, "at least the test IRS update (and usually seed samples) must be published");
    const leftoverUscis = await db.agencyUpdate.count({ where: { sourceAgency: "USCIS" } });
    assert.equal(leftoverUscis, 0, "no USCIS agency updates should remain after retarget");

    console.log("IRS updates check passed — feed parse, homepage/listing surfaces, paid case-impact gate");
  } finally {
    if (subId) await db.subscription.delete({ where: { id: subId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (updateId) await db.agencyUpdate.delete({ where: { id: updateId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
