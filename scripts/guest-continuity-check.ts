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
      claimed: { sessionId: "s", threadId: "t1", caseId: "c1" },
    }),
    "/app/qa/t1",
  );
  assert.equal(
    continuePathAfterAuth({
      next: "/app/cases/c9",
      claimed: { sessionId: "s", threadId: "t1", caseId: "c1" },
    }),
    "/app/cases/c9",
  );
  assert.equal(
    continuePathAfterAuth({
      claimed: { sessionId: "s", threadId: null, caseId: "c1" },
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

  const startQa = read("src/app/start/qa/page.tsx");
  assert.ok(startQa.includes("/app/qa/"), "signed-in /start/qa must keep thread when owned");
  assert.ok(startQa.includes("owned"), "signed-in /start/qa must look up owned thread");

  const qa = read("src/components/qa-chat.tsx");
  assert.ok(qa.includes("register?next="), "register CTA must carry conversation next");

  const register = read("src/app/register/page.tsx");
  assert.ok(register.includes("setAuthNextCookie"));
  assert.ok(register.includes("start over") || register.includes("back to this conversation"));

  const reply = read("src/components/assistant-reply.tsx");
  assert.ok(reply.includes("text-teal-700"), "account/pro offers use teal emphasis");
}

console.log("guest-continuity-check: ok");
