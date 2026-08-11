import "server-only";
import { db } from "./db";
import { getNumberSetting } from "./settings";

// Soft-deleted accounts are retained for an admin-configurable number of days
// (default 90) before being expunged permanently.

export async function getRetentionDays(): Promise<number> {
  return getNumberSetting("users.deleted_retention_days", 90);
}

export async function purgeExpiredDeletedAccounts(): Promise<number> {
  const days = await getRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await db.user.deleteMany({
    where: { status: "deleted", deletedAt: { lt: cutoff }, role: { not: "super_admin" } },
  });
  return res.count;
}
