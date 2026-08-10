import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { AdminRoleForms } from "@/components/admin/admin-role-forms";
import { ADMIN_AREAS } from "@/lib/constants";

export const metadata = { title: "Admin roles" };

export default async function AdminRolesPage() {
  const actor = await guardAdminPage("admin.admins");
  const admins = await db.user.findMany({
    where: { role: { in: ["admin", "super_admin"] } },
    orderBy: { createdAt: "asc" },
    include: { adminPermissions: true },
  });

  return (
    <div>
      <PageHeader
        title="Admin roles"
        subtitle="The super admin sees everything. Create additional admins that manage only the areas you choose."
      />
      <div className="space-y-4">
        {admins.map((a) => (
          <Card key={a.id}>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{a.firstName} {a.lastName} <span className="font-normal text-slate-400">· {a.email}</span></p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.role === "super_admin" ? (
                      <Badge color="indigo">All areas (super admin)</Badge>
                    ) : (
                      a.adminPermissions.map((p) => (
                        <Badge key={p.id}>{ADMIN_AREAS.find((x) => x.key === p.featureKey)?.name ?? p.featureKey}</Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {a.role !== "super_admin" && actor.role === "super_admin" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-indigo-600">Edit permissions</summary>
                  <div className="mt-3">
                    <AdminRoleForms mode="edit" userId={a.id} currentAreas={a.adminPermissions.map((p) => p.featureKey)} />
                  </div>
                </details>
              )}
            </CardBody>
          </Card>
        ))}
        {actor.role === "super_admin" && (
          <Card>
            <CardBody>
              <h2 className="mb-3 font-semibold text-slate-900">Create a new admin</h2>
              <AdminRoleForms mode="create" userId="" currentAreas={[]} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
