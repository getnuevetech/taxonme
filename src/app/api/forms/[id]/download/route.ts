import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { FEATURE_KEYS } from "@/lib/constants";
import { sameOriginRedirect } from "@/lib/http";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Downloadable copy of a completed IRS form. Whether this requires a paid
// plan is controlled by the admin (forms.paid_downloads setting).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const submission = await db.formSubmission.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!submission) return new NextResponse("Not found", { status: 404 });

  // Access: the owner, an admin, or a consultant with an ACTIVE connection to the owner.
  const isOwner = submission.userId === user.id;
  const { isAdmin } = await import("@/lib/auth");
  let allowed = isOwner || isAdmin(user);
  if (!allowed && user.role === "consultant") {
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: submission.userId, status: "active" },
    });
    allowed = Boolean(assignment);
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });
  if (submission.status !== "completed") return new NextResponse("Form not completed yet", { status: 400 });

  // Admin-controlled fee gate (applies to the customer; staff and connected
  // consultants download without the customer's plan gate).
  const paid = await getBoolSetting("forms.paid_downloads", true);
  if (isOwner && paid) {
    if (!(await hasFeature(user.id, FEATURE_KEYS.FORMS_DOWNLOAD))) {
      return sameOriginRedirect("/app/billing?upgrade=forms-download");
    }
    const { getFormDownloadQuota } = await import("@/lib/billing-quotas");
    const quota = await getFormDownloadQuota(user.id);
    if (quota.overLimit) {
      return sameOriginRedirect("/app/billing?upgrade=forms_download_limit");
    }
  }

  // Preferred output: the OFFICIAL IRS PDF with the customer's answers infused
  // into its real form fields. Falls back to the text worksheet only when the
  // template has no official PDF + mapping configured.
  const { fillOfficialPdf } = await import("@/lib/pdf-forms");
  const data: Record<string, string> = JSON.parse(submission.dataJson || "{}");
  const filled = await fillOfficialPdf(submission.template, data);
  if (filled) {
    return new NextResponse(new Uint8Array(filled), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Form-${submission.template.formNumber.replace(/[^\w-]/g, "")}-filled.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const appName = await getSetting("app.name", "TaxOnMe");
  const generatedAt = new Date().toLocaleString("en-US");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Form ${esc(submission.template.formNumber)} — ${esc(submission.template.title)}</title>
<style>
  body { font-family: 'Courier New', monospace; color: #111827; max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  header { font-family: Arial, sans-serif; border-bottom: 3px solid #111827; padding-bottom: 12px; margin-bottom: 24px; }
  h1 { font-size: 20px; margin: 0; }
  .meta { font-size: 12px; color: #4b5563; margin-top: 4px; }
  pre { white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
  footer { font-family: Arial, sans-serif; margin-top: 32px; border-top: 1px solid #d1d5db; padding-top: 10px; font-size: 10px; color: #9ca3af; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<header>
  <h1>Form ${esc(submission.template.formNumber)} — ${esc(submission.template.title)}</h1>
  <p class="meta">Prepared with ${esc(appName)} for ${esc(`${user.firstName} ${user.lastName}`.trim() || user.email)} · ${generatedAt}</p>
</header>
<pre>${esc(submission.generatedText || "")}</pre>
<footer>
  This worksheet mirrors the layout of the official IRS form to make transferring your answers easy. Always compare against
  the current official IRS form before filing. Prepared by ${esc(appName)} — not the IRS, a CPA firm, or a law firm.
</footer>
</body>
</html>`;

  const download = new URL(request.url).searchParams.get("view") !== "1";
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(download
        ? { "Content-Disposition": `attachment; filename="Form-${submission.template.formNumber.replace(/[^\w-]/g, "")}-completed.html"` }
        : {}),
    },
  });
}
