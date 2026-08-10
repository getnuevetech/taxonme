import { db } from "./db";

// All app variables are stored in the Setting table and managed from the admin backend.
// Nothing business-facing is hardcoded; these helpers only read/write the DB.

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function getSettings(prefix?: string) {
  const rows = await db.setting.findMany({
    where: prefix ? { key: { startsWith: prefix } } : undefined,
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return rows;
}

export async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const v = await getSetting(key, fallback ? "true" : "false");
  return v === "true" || v === "1";
}

export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const v = await getSetting(key, String(fallback));
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
