import "server-only";
import { db } from "@/lib/db";
import {
  DEFAULT_USCIS_ALERTS_URL,
  DEFAULT_USCIS_FEED_URL,
  SETTINGS,
} from "@/lib/constants";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { parseAgencyFeedXml, parseUscisNewsroomHtml, slugifyUpdateTitle, type ParsedFeedItem } from "./parse";

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

export async function syncAgencyUpdates(): Promise<SyncResult> {
  const enabled = await getBoolSetting(SETTINGS.USCIS_SYNC_ENABLED, true);
  if (!enabled) return { fetched: 0, upserted: 0, source: "none", error: "sync disabled" };

  const agency = await getSetting(SETTINGS.USCIS_AGENCY_LABEL, "USCIS");
  const feedUrl = await getSetting(SETTINGS.USCIS_FEED_URL, DEFAULT_USCIS_FEED_URL);
  const alertsUrl = await getSetting(SETTINGS.USCIS_ALERTS_URL, DEFAULT_USCIS_ALERTS_URL);

  const feed = await fetchText(feedUrl);
  if (feed.ok && /<(rss|feed|rdf:RDF)\b/i.test(feed.text)) {
    const items = parseAgencyFeedXml(feed.text);
    const upserted = await upsertItems(agency, items);
    await db.setting.upsert({
      where: { key: "uscis.last_sync_at" },
      update: { value: new Date().toISOString() },
      create: { key: "uscis.last_sync_at", value: new Date().toISOString(), group: "uscis", label: "Last USCIS sync", type: "text" },
    });
    await db.setting.upsert({
      where: { key: "uscis.last_sync_status" },
      update: { value: `ok:rss:${upserted}` },
      create: { key: "uscis.last_sync_status", value: `ok:rss:${upserted}`, group: "uscis", label: "Last USCIS sync status", type: "text" },
    });
    return { fetched: items.length, upserted, source: "rss" };
  }

  const html = await fetchText(alertsUrl);
  if (html.ok && /<html/i.test(html.text)) {
    const items = parseUscisNewsroomHtml(html.text, alertsUrl);
    const upserted = await upsertItems(agency, items);
    await db.setting.upsert({
      where: { key: "uscis.last_sync_at" },
      update: { value: new Date().toISOString() },
      create: { key: "uscis.last_sync_at", value: new Date().toISOString(), group: "uscis", label: "Last USCIS sync", type: "text" },
    });
    await db.setting.upsert({
      where: { key: "uscis.last_sync_status" },
      update: { value: `ok:html:${upserted}` },
      create: { key: "uscis.last_sync_status", value: `ok:html:${upserted}`, group: "uscis", label: "Last USCIS sync status", type: "text" },
    });
    return { fetched: items.length, upserted, source: "html" };
  }

  const error = `RSS HTTP ${feed.status}; HTML HTTP ${html.status}`;
  await db.setting.upsert({
    where: { key: "uscis.last_sync_status" },
    update: { value: `error:${error.slice(0, 200)}` },
    create: { key: "uscis.last_sync_status", value: `error:${error.slice(0, 200)}`, group: "uscis", label: "Last USCIS sync status", type: "text" },
  });
  const { logSystem } = await import("@/lib/syslog");
  await logSystem("warning", "uscis_sync", "USCIS update sync failed — feed unreachable from this host", {
    feedStatus: feed.status,
    alertsStatus: html.status,
    feedSnippet: feed.text.slice(0, 200),
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
