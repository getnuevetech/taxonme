import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { RoleForm } from "@/components/admin/role-form";
import { deleteAdminRoleAction } from "@/actions/admin";
import { ADMIN_AREAS } from "@/lib/constants";

export const metadata = { title: "Roles & permissions" };

export default async function AdminRolesManagementPage() {
  await guardAdminPage("admin.roles");
  const roles = await db.adminRole.findMany({
    orderBy: { createdAt: "asc" },
    include: { users: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  const areaName = (k: string) => ADMIN_AREAS.find((a) => a.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        subtitle="Create roles, choose which admin areas each role can manage, then assign roles to admin users under Admin users."
      />
      <div className="space-y-4">
        {roles.map((r) => {
          const areas: string[] = JSON.parse(r.areasJson || "[]");
          return (
            <Card key={r.id}>
              <CardBody>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.name}</span>
                    <Badge color="indigo">{areas.length} area{areas.length === 1 ? "" : "s"}</Badge>
                    <Badge>{r.users.length} admin{r.users.length === 1 ? "" : "s"}</Badge>
                    {r.description && <span className="text-sm text-slate-500">{r.description}</span>}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {areas.map((a) => <Badge key={a}>{areaName(a)}</Badge>)}
                  </div>
                  {r.users.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Assigned to: {r.users.map((u) => `${u.firstName} ${u.lastName}`.trim() || u.email).join(", ")}
                    </p>
                  )}
                  <div className="mt-4">
                    <RoleForm role={{ id: r.id, name: r.name, description: r.description, areas }} />
                    <form action={deleteAdminRoleAction.bind(null, r.id)} className="mt-2 text-right">
                      <button className="text-xs font-medium text-red-500 hover:text-red-700">
                        Delete role{r.users.length > 0 ? ` (${r.users.length} admin${r.users.length === 1 ? "" : "s"} will lose access until reassigned)` : ""}
                      </button>
                    </form>
                  </div>
                </details>
              </CardBody>
            </Card>
          );
        })}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Create a role</h2>
            <RoleForm role={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
