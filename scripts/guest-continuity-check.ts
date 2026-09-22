/**
 * Guest conversation continuity after register/login.
 * Run: tsx scripts/guest-continuity-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { continuePathAfterAuth, sanitizeAuthNext } from "../src/lib/auth-continue";

const root = join(__dirname, "..");
function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

{
  assert.equal(sanitizeAuthNext("/app/qa/abc123"), "/app/qa/abc123");
  assert.equal(sanitizeAuthNext("/start/qa?thread=x"), "/start/qa?thread=x");
  assert.equal(sanitizeAuthNext("https://evil.example/phish"), null);
  assert.equal(sanitizeAuthNext("//evil.example"), null);
  assert.equal(sanitizeAuthNext("/admin"), null);

  assert.equal(
    continuePathAfterAuth({
      claimed: { sessionId: "s", threadId: "t1", caseId: "c1", situationId: null },
    }),
    "/app/qa/t1",
  );
  assert.equal(
    continuePathAfterAuth({
      next: "/app/cases/c9",
      claimed: { sessionId: "s", threadId: "t1", caseId: "c1", situationId: "sit1" },
    }),
    "/app/cases/c9",
  );
  assert.equal(
    continuePathAfterAuth({
      claimed: { sessionId: "s", threadId: null, caseId: "c1", situationId: "sit9" },
    }),
    "/app/situations/sit9",
  );
  assert.equal(
    continuePathAfterAuth({
      claimed: { sessionId: "s", threadId: null, caseId: "c1", situationId: null },
    }),
    "/app/cases/c1",
  );
}

{
  const auth = read("src/actions/auth.ts");
  assert.ok(auth.includes("continuePathAfterAuth"), "register/login must resume guest work");
  assert.ok(auth.includes('formData.get("next")'), "auth actions must honor next");

  const guest = read("src/lib/guest.ts");
  assert.ok(guest.includes("ClaimedGuestWork"));
  assert.ok(guest.includes("threadId"));
  assert.ok(guest.includes("situationId"));
  assert.ok(guest.includes("db.situation.updateMany"));

  const startQa = read("src/app/start/qa/page.tsx");
  assert.ok(startQa.includes("/app/qa/"), "signed-in /start/qa must keep thread when owned");
  assert.ok(startQa.includes("owned"), "signed-in /start/qa must look up owned thread");
  // "Track this government case" used to point guests at /app/cases/new,
  // which just bounces an anonymous visitor to sign-in with no context.
  assert.ok(!startQa.includes("promoteCaseHref"), "guest QA page must not offer a case-tracking link that requires sign-in");

  // Registering/logging in claims a Situation/PrepPlan/Case onto the account
  // and deletes the guest cookie — a returning visitor hitting the pre-signup
  // /start/... link (bookmark, browser back) must be sent to their saved
  // copy, not silently told (or shown) it's gone. Same pattern as /start/qa
  // above, for the three guest pages that didn't have it.
  const startSituation = read("src/app/start/situation/page.tsx");
  assert.ok(startSituation.includes("getCurrentUser"), "/start/situation must check for a returning owner first");
  assert.ok(startSituation.includes("/app/situations/"), "/start/situation must resume the account copy when owned");
  assert.ok(startSituation.includes("saved to an account"), "/start/situation must explain a claimed link, not 404 it");

  const startPrepPlan = read("src/app/start/prep-plan/page.tsx");
  assert.ok(startPrepPlan.includes("getCurrentUser"), "/start/prep-plan must check for a returning owner first");
  assert.ok(startPrepPlan.includes("/app/prep-plans/"), "/start/prep-plan must resume the account copy when owned");
  assert.ok(startPrepPlan.includes("saved to an account"), "/start/prep-plan must explain a claimed link, not 404 it");

  const startResult = read("src/app/start/result/page.tsx");
  assert.ok(startResult.includes("saved to an account"), "/start/result must explain a claimed case, not silently bounce to /start");

  const qa = read("src/components/qa-chat.tsx");
  assert.ok(qa.includes("register?next="), "register CTA must carry conversation next");
  // "Track this government case" pointed guests at an /app/cases/new link
  // that just bounced them to sign-in with no context — QaChat now only
  // renders it when a promoteCaseHref is actually supplied.
  assert.match(qa, /promoteCaseHref\s*&&/, "QaChat must not render the case-tracking link without an href");

  // Next.js can only write cookies in a Server Action or Route Handler, never
  // during a page's render — register/login used to call setAuthNextCookie()
  // straight in the render body, which threw ("Cookies can only be modified
  // in a Server Action or Route Handler") any time `next` was set, i.e. on
  // exactly the guest-continuity links this suite exists to protect. Fixed
  // by moving the cookie write to /api/auth/google (a Route Handler), reached
  // via a `next` query param instead.
  const register = read("src/app/register/page.tsx");
  assert.ok(!register.includes("setAuthNextCookie"), "register page must not write cookies during render");
  assert.ok(register.includes("api/auth/google?next="), "register's Google button must carry next as a query param");
  assert.ok(register.includes("start over") || register.includes("back to this conversation"));

  const loginPage = read("src/app/login/page.tsx");
  assert.ok(!loginPage.includes("setAuthNextCookie"), "login page must not write cookies during render");
  assert.ok(loginPage.includes("api/auth/google?next="), "login's Google button must carry next as a query param");

  const googleRoute = read("src/app/api/auth/google/route.ts");
  assert.ok(googleRoute.includes("setAuthNextCookie"), "Google OAuth start route must persist next for the redirect round trip");

  const reply = read("src/components/assistant-reply.tsx");
  assert.ok(reply.includes("text-teal-700"), "account/pro offers use teal emphasis");
}

console.log("guest-continuity-check: ok");
