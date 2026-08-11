import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";

// Typeahead search over customers and consultants by name, email, or mobile.
// Used by admin forms instead of unscalable dropdowns.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const allowed =
    user &&
    (hasAdminArea(user, "admin.tickets") ||
      hasAdminArea(user, "admin.users") ||
      hasAdminArea(user, "admin.consultants") ||
      hasAdminArea(user, "admin.assignments"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await db.user.findMany({
    where: {
      role: { in: ["user", "consultant"] },
      status: "active",
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
  });

  return NextResponse.json({
    results: results.map((u) => ({
      id: u.id,
      label: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      phone: u.phone,
      role: u.role === "consultant" ? "consultant" : "customer",
    })),
  });
}
