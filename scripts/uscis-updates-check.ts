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
  const { parseAgencyFeedXml, parseUscisNewsroomHtml, slugifyUpdateTitle } = await import("../src/lib/agency-updates/parse");
  const db = (await import("../src/lib/db")).db;
  const { FEATURE_KEYS } = await import("../src/lib/constants");
  const { userCanSeeCaseImpact, analyzeUpdateImpactForCase } = await import("../src/lib/agency-updates/impact");
  const { syncAgencyUpdates } = await import("../src/lib/agency-updates/sync");

  const rss = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <item>
      <title><![CDATA[USCIS Opens Asylum Office in Atlanta]]></title>
      <link>https://www.uscis.gov/newsroom/news-releases/uscis-opens-asylum-office-in-atlanta</link>
      <guid>https://www.uscis.gov/newsroom/news-releases/uscis-opens-asylum-office-in-atlanta</guid>
      <pubDate>Mon, 11 Aug 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[USCIS opened a new asylum office in Atlanta to serve the Southeast.]]></description>
    </item>
    <item>
      <title>USCIS Reaches Fiscal Year 2027 H-1B Cap</title>
      <link>https://www.uscis.gov/newsroom/alerts/h1b-cap</link>
      <guid>h1b-cap-2027</guid>
      <description>The H-1B cap has been reached for FY2027.</description>
      <pubDate>Tue, 12 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel></rss>`;
  const parsed = parseAgencyFeedXml(rss);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "USCIS Opens Asylum Office in Atlanta");
  assert.match(parsed[0].sourceUrl, /atlanta/);
  assert.ok(slugifyUpdateTitle(parsed[0].title, parsed[0].externalId).includes("uscis-opens"));

  const html = `
    <html><body>
      <a href="/newsroom/alerts/form-i-485">USCIS to Publish New Edition of Form I-485</a>
      <a href="/newsroom">Newsroom</a>
      <a href="https://www.uscis.gov/newsroom/alerts/public-charge">USCIS Issues Guidance on Making Public Charge Inadmissibility Determination</a>
    </body></html>`;
  const scraped = parseUscisNewsroomHtml(html, "https://www.uscis.gov/newsroom/alerts");
  assert.ok(scraped.length >= 2);
  assert.ok(scraped.some((i) => /I-485/i.test(i.title)));

  // Static surface checks.
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /UpdatesSection/);
  assert.match(readFileSync("src/app/updates/page.tsx", "utf8"), /listPublishedUpdates/);
  assert.match(readFileSync("src/app/updates/[slug]/page.tsx", "utf8"), /CaseImpactPanel/);
  assert.match(readFileSync("src/app/app/updates/page.tsx", "utf8"), /userCanSeeCaseImpact/);
  assert.match(readFileSync("src/components/site-nav.tsx", "utf8"), /\/updates/);
  assert.match(readFileSync("src/app/api/cron/maintenance/route.ts", "utf8"), /syncAgencyUpdates/);
  assert.match(readFileSync("prisma/seed.ts", "utf8"), /updates\.case_impact/);
  assert.match(readFileSync("prisma/seed.ts", "utf8"), /seedUscisUpdates/);

  const email = `uscis-updates-${Date.now()}@example.com`;
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
        slug: `test-i485-${Date.now()}`,
        title: "USCIS to Publish New Edition of Form I-485",
        summary: "New I-485 edition required for adjustment of status filings.",
        body: "Applicants for adjustment of status must use the new Form I-485 edition after the effective date.",
        sourceAgency: "USCIS",
        externalId: `test:${Date.now()}`,
        sourceUrl: "https://www.uscis.gov/newsroom/alerts",
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    updateId = update.id;

    const c = await db.case.create({
      data: {
        userId: user.id,
        title: "Adjustment of status with Form I-485",
        situation: "I filed Form I-485 for adjustment of status and am waiting on a decision.",
        goal: "Get my green card approved without rejection for the wrong form edition.",
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
    // Live USCIS may be CDN-blocked in this environment; that is acceptable as long as seeded/manual updates remain.
    const published = await db.agencyUpdate.count({ where: { isPublished: true } });
    assert.ok(published >= 1, "at least the test update (and usually seed samples) must be published");

    console.log("USCIS updates check passed — feed parse, homepage/listing surfaces, paid case-impact gate");
  } finally {
    if (subId) await db.subscription.delete({ where: { id: subId } }).catch(() => undefined);
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (updateId) await db.agencyUpdate.delete({ where: { id: updateId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
