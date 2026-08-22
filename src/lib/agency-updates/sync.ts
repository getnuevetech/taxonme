import "server-only";
import { db } from "@/lib/db";
import {
  DEFAULT_IRS_ALERTS_URL,
  DEFAULT_IRS_FEED_URL,
  SETTINGS,
} from "@/lib/constants";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { parseAgencyFeedXml, parseIrsNewsroomHtml, slugifyUpdateTitle, type ParsedFeedItem } from "./parse";

export type SyncResult = {
  fetched: number;
  upserted: number;
  source: "rss" | "html" | "none";
  error?: string;
};

const FETCH_HEADERS = {
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
  "User-Agent": "TaxOnMeAgencyUpdates/1.0 (+https://mytaxonme.com; official-news sync)",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: String(err) };
  }
}

async function upsertItems(agency: string, items: ParsedFeedItem[]): Promise<number> {
  let upserted = 0;
  const now = new Date();
  for (const item of items) {
    const externalId = item.externalId || item.sourceUrl || item.title;
    if (!externalId) continue;
    const slug = slugifyUpdateTitle(item.title, externalId);
    await db.agencyUpdate.upsert({
      where: { sourceAgency_externalId: { sourceAgency: agency, externalId } },
      update: {
        title: item.title,
        summary: item.summary,
        body: item.body || item.summary,
        sourceUrl: item.sourceUrl,
        tagsJson: JSON.stringify(item.tags),
        publishedAt: item.publishedAt,
        syncedAt: now,
        isPublished: true,
      },
      create: {
        slug,
        title: item.title,
        summary: item.summary,
        body: item.body || item.summary,
        sourceUrl: item.sourceUrl,
        sourceAgency: agency,
        externalId,
        tagsJson: JSON.stringify(item.tags),
        publishedAt: item.publishedAt,
        syncedAt: now,
        isPublished: true,
      },
    });
    upserted += 1;
  }
  return upserted;
}

async function writeSyncMeta(status: string) {
  const now = new Date().toISOString();
  await db.setting.upsert({
    where: { key: "irs.last_sync_at" },
    update: { value: now, group: "irs", label: "Last IRS sync" },
    create: { key: "irs.last_sync_at", value: now, group: "irs", label: "Last IRS sync", type: "text" },
  });
  await db.setting.upsert({
    where: { key: "irs.last_sync_status" },
    update: { value: status, group: "irs", label: "Last IRS sync status" },
    create: { key: "irs.last_sync_status", value: status, group: "irs", label: "Last IRS sync status", type: "text" },
  });
}

export async function syncAgencyUpdates(): Promise<SyncResult> {
  const enabled = await getBoolSetting(SETTINGS.IRS_SYNC_ENABLED, true);
  if (!enabled) return { fetched: 0, upserted: 0, source: "none", error: "sync disabled" };

  const agency = await getSetting(SETTINGS.IRS_AGENCY_LABEL, "IRS");
  const feedUrl = await getSetting(SETTINGS.IRS_FEED_URL, DEFAULT_IRS_FEED_URL);
  const alertsUrl = await getSetting(SETTINGS.IRS_ALERTS_URL, DEFAULT_IRS_ALERTS_URL);

  // Prefer the HTML newsroom (IRS no longer ships a reliable public RSS file).
  // Still try an optional RSS URL first when an admin configures one.
  if (feedUrl && feedUrl !== alertsUrl) {
    const feed = await fetchText(feedUrl);
    if (feed.ok && /<(rss|feed|rdf:RDF)\b/i.test(feed.text)) {
      const items = parseAgencyFeedXml(feed.text);
      const upserted = await upsertItems(agency, items);
      await writeSyncMeta(`ok:rss:${upserted}`);
      return { fetched: items.length, upserted, source: "rss" };
    }
  }

  const html = await fetchText(alertsUrl);
  if (html.ok && /<html/i.test(html.text)) {
    const items = parseIrsNewsroomHtml(html.text, alertsUrl);
    const upserted = await upsertItems(agency, items);
    await writeSyncMeta(`ok:html:${upserted}`);
    return { fetched: items.length, upserted, source: "html" };
  }

  const error = `newsroom HTML HTTP ${html.status}`;
  await writeSyncMeta(`error:${error.slice(0, 200)}`);
  const { logSystem } = await import("@/lib/syslog");
  await logSystem("warning", "irs_sync", "IRS update sync failed — newsroom unreachable from this host", {
    alertsStatus: html.status,
    snippet: html.text.slice(0, 200),
  });
  return { fetched: 0, upserted: 0, source: "none", error };
}

export async function listPublishedUpdates(take = 50) {
  return db.agencyUpdate.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take,
  });
}

export async function getPublishedUpdateBySlug(slug: string) {
  return db.agencyUpdate.findFirst({ where: { slug, isPublished: true } });
}
