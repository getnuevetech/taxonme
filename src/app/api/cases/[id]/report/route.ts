import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildCaseReportHtml } from "@/lib/case-report";
import { consumeCaseReportDownload, getCaseReportAccess } from "@/lib/case-report-quota";
import { sameOriginRedirect } from "@/lib/http";

// Full case report (view inline or ?download=1). Access:
// - the case owner, consuming their plan's included downloads (Free 1 / Plus 3 / Pro 7)
// - extra downloads after the allowance, once the admin-set fee is paid
// - a consultant with an ACTIVE connection (unmetered when partner subscriptions
//   are off; otherwise against the consultant's plan allowance)
// - admins (unmetered)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const c = await db.case.findUnique({ where: { id }, select: { userId: true } });
  if (!c) return new NextResponse("Not found", { status: 404 });

  let access = await getCaseReportAccess(user, id);
  if (access.paywall) {
    const { reconcilePendingStripeTransactions } = await import("@/lib/payments");
    await reconcilePendingStripeTransactions(user.id);
    access = await getCaseReportAccess(user, id);
  }
  if (access.billingRedirect) return sameOriginRedirect(access.billingRedirect);
  if (access.quotaRedirect && !access.allowed) return sameOriginRedirect(access.quotaRedirect);
  if (!access.allowed) return new NextResponse("Forbidden", { status: 403 });

  if (access.metered) {
    const consumed = await consumeCaseReportDownload(user.id, id);
    if (consumed === "payment_required") {
      return sameOriginRedirect(access.quotaRedirect ?? `/app/cases/${id}?report_quota=1`);
    }
  }

  const report = await buildCaseReportHtml(id);
  if (!report) return new NextResponse("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(report.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="${report.fileName}"` } : {}),
    },
  });
}
