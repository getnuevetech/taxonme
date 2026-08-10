import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminArea, isAdmin, type CurrentUser } from "./auth";

// Page-level guard: redirects instead of throwing so admin pages fail gracefully.
export async function guardAdminPage(areaKey: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/app");
  if (!hasAdminArea(user, areaKey)) redirect("/admin");
  return user;
}
