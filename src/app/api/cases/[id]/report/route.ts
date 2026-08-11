import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { buildCaseReportHtml } from "@/lib/case-report";

// Full case report (view inline or ?download=1). Access:
// - the case owner, when their plan includes the report feature (the "fee")
// - a consultant with an ACTIVE connection to the owner (plus a partner plan
//   when consultant subscriptions are enabled)
// - admins
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const c = await db.case.findUnique({ where: { id }, select: { userId: true } });
  if (!c) return new NextResponse("Not found", { status: 404 });

  let allowed = false;
  if (isAdmin(user)) allowed = true;
  else if (c.userId === user.id) {
    allowed = await hasFeature(user.id, FEATURE_KEYS.CASE_REPORT);
    if (!allowed) return NextResponse.redirect(new URL("/app/billing?upgrade=report", request.url));
  } else if (user.role === "consultant" && c.userId) {
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
    });
    if (assignment) {
      const { consultantSubscriptionsEnabled, hasActiveConsultantSubscription } = await import("@/lib/payments");
      allowed = !(await consultantSubscriptionsEnabled()) || (await hasActiveConsultantSubscription(user.id));
      if (!allowed) return NextResponse.redirect(new URL("/consultant/billing?required=1", request.url));
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const report = await buildCaseReportHtml(id);
  if (!report) return new NextResponse("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(report.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download ? { "Content-Disposition": `attachment; filename="${report.fileName}"` } : {}),
    },
  });
}
