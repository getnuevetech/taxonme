import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PeopleTabs } from "@/components/admin/people-tabs";
import { CreateAdminForm, AssignRoleForm } from "@/components/admin/admin-user-forms";
import { ADMIN_AREAS } from "@/lib/constants";

export const metadata = { title: "Admin users" };

export default async function AdminUsersPage() {
  const actor = await guardAdminPage("admin.admins");
  const [admins, roles] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      orderBy: { createdAt: "asc" },
      include: { adminRole: true, adminPermissions: true },
    }),
    db.adminRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const areaName = (k: string) => ADMIN_AREAS.find((a) => a.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Admin users"
        subtitle="Each admin gets a role; the role decides what they can manage. Roles are defined under Roles & permissions."
      />
      <PeopleTabs active="admins" />

      {roles.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No roles exist yet. Create roles under{" "}
          <Link href="/admin/roles" className="font-semibold underline">Roles &amp; permissions</Link> before adding admin users.
        </div>
      )}

      <div className="space-y-4">
        {admins.map((a) => {
          const roleAreas: string[] = a.adminRole ? JSON.parse(a.adminRole.areasJson || "[]") : [];
          return (
            <Card key={a.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {a.firstName} {a.lastName} <span className="font-normal text-slate-400">· {a.email}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {a.role === "super_admin" ? (
                        <Badge color="indigo">Super admin — all areas</Badge>
                      ) : a.adminRole ? (
                        <>
                          <Badge color="indigo">{a.adminRole.name}</Badge>
                          {roleAreas.map((k) => <Badge key={k}>{areaName(k)}</Badge>)}
                        </>
                      ) : a.adminPermissions.length > 0 ? (
                        <>
                          <Badge color="amber">Legacy permissions (assign a role)</Badge>
                          {a.adminPermissions.map((p) => <Badge key={p.id}>{areaName(p.featureKey)}</Badge>)}
                        </>
                      ) : (
                        <Badge color="red">No role — no admin access</Badge>
                      )}
                    </div>
                  </div>
                  {a.role !== "super_admin" && actor.role === "super_admin" && (
                    <AssignRoleForm userId={a.id} currentRoleId={a.adminRoleId ?? ""} roles={roles} />
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}

        {actor.role === "super_admin" && (
          <Card>
            <CardBody>
              <h2 className="mb-3 font-semibold text-slate-900">Create a new admin user</h2>
              <CreateAdminForm roles={roles} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
