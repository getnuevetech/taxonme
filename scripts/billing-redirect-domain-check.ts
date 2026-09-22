/**
 * Stripe checkout success/cancel URLs must resolve to the same domain the
 * session cookie is scoped to (the global app.url setting), not a separately
 * admin-configured per-gateway field that can silently drift out of sync.
 *
 * A mismatch there sends the browser back from checkout.stripe.com to a
 * different origin than the one holding the session cookie — the user lands
 * "logged out," and their pre-upgrade Situation/Case looks like it vanished
 * even though nothing was deleted. Confirmed live: a guest's Situation/QA
 * thread survives signup and a same-origin (manual gateway) upgrade, but the
 * report was specifically that a real Stripe upgrade is where it goes missing.
 *
 * Run: npx tsx scripts/billing-redirect-domain-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const billing = readFileSync(join(root, "src/actions/billing.ts"), "utf8");

// subscribeAction: getSetting("app.url", ...) must be read and preferred
// ahead of cfg.appUrl for the success/cancel URLs.
const subscribeMatch = billing.match(
  /const appUrl = \(\(\(await getSetting\("app\.url", ""\)\) \|\| cfg\.appUrl \|\| ""\)[\s\S]{0,40}\)\.replace/,
);
assert.ok(subscribeMatch, "subscribeAction must prefer the global app.url setting over the gateway's own appUrl field");
assert.match(billing, /success_url: `\$\{appUrl\}\$\{billingPath\}\?pending=1`/, "subscribeAction success_url must use the resolved appUrl");
assert.match(billing, /cancel_url: `\$\{appUrl\}\$\{billingPath\}\?canceled=1`/, "subscribeAction cancel_url must use the resolved appUrl");
assert.doesNotMatch(billing, /success_url: `\$\{cfg\.appUrl \|\| ""\}/, "subscribeAction must not fall back to a bare cfg.appUrl for success_url");

// purchaseCaseReportExtraAction: same priority — global setting first.
const extraMatch = billing.match(
  /const appUrl = String\(\(await import\("@\/lib\/settings"\)\.then\(\(m\) => m\.getSetting\("app\.url", ""\)\)\) \|\| cfg\.appUrl \|\| ""\)\.replace/,
);
assert.ok(extraMatch, "purchaseCaseReportExtraAction must prefer the global app.url setting over the gateway's own appUrl field");

console.log("billing-redirect-domain-check: ok");
