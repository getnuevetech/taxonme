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
  pages?: number;
  error?: string;
};

/** Rolling window the public list must always cover (current + previous week). */
export const IRS_UPDATES_MIN_LOOKBACK_DAYS = 14;

const FETCH_HEADERS = {
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
  "User-Agent": "TaxOnMeAgencyUpdates/1.0 (+https://mytaxonme.com; official-news sync)",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** IRS archive pages for completed months: /newsroom/news-releases-for-{month}-{year} */
export function irsMonthNewsroomUrl(when: Date = new Date()): string {
  return `https://www.irs.gov/newsroom/news-releases-for-${MONTH_SLUGS[when.getUTCMonth()]}-${when.getUTCFullYear()}`;
}

/**
 * Pages that together cover the current week and the previous week.
 * Current month uses the live "current-month" listing (named month URLs 404 while
 * the month is still open). Previous calendar month is always fetched too so the
 * prior week is covered early in a new month.
 */
export function irsNewsroomUrlsForRollingWeeks(
  primaryUrl: string = DEFAULT_IRS_ALERTS_URL,
  now: Date = new Date(),
): string[] {
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const urls = [primaryUrl.trim() || DEFAULT_IRS_ALERTS_URL, irsMonthNewsroomUrl(prevMonth)];
  // If primary is not the live current-month page, still pull it explicitly.
  if (!/news-releases-for-current-month/i.test(primaryUrl)) {
    urls.unshift(DEFAULT_IRS_ALERTS_URL);
  }
  return [...new Set(urls.filter(Boolean))];
}

export function startOfRollingTwoWeeks(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (IRS_UPDATES_MIN_LOOKBACK_DAYS - 1));
  return d;
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url };
  } catch (err) {
    return { ok: false, status: 0, text: String(err), url };
  }
}

function dedupeItems(items: ParsedFeedItem[]): ParsedFeedItem[] {
  const seen = new Set<string>();
  const out: ParsedFeedItem[] = [];
  for (const item of items) {
    const key = (item.externalId || item.sourceUrl || item.title).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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

  // Optional RSS still supported when an admin configures one.
  if (feedUrl && feedUrl !== alertsUrl) {
    const feed = await fetchText(feedUrl);
    if (feed.ok && /<(rss|feed|rdf:RDF)\b/i.test(feed.text)) {
      const items = parseAgencyFeedXml(feed.text);
      const upserted = await upsertItems(agency, items);
      await writeSyncMeta(`ok:rss:${upserted}`);
      return { fetched: items.length, upserted, source: "rss", pages: 1 };
    }
  }

  const urls = irsNewsroomUrlsForRollingWeeks(alertsUrl);
  const collected: ParsedFeedItem[] = [];
  const pageErrors: string[] = [];
  let pagesOk = 0;

  for (const url of urls) {
    const html = await fetchText(url);
    if (!html.ok || !/<html/i.test(html.text)) {
      pageErrors.push(`${url} HTTP ${html.status}`);
      continue;
    }
    const items = parseIrsNewsroomHtml(html.text, url);
    if (items.length === 0) {
      pageErrors.push(`${url} parsed 0`);
      continue;
    }
    collected.push(...items);
    pagesOk += 1;
  }

  const items = dedupeItems(collected);
  if (items.length > 0) {
    const upserted = await upsertItems(agency, items);
    await writeSyncMeta(`ok:html:${upserted}:pages:${pagesOk}`);
    return {
      fetched: items.length,
      upserted,
      source: "html",
      pages: pagesOk,
      error: pageErrors.length ? pageErrors.join("; ") : undefined,
    };
  }

  const error = pageErrors.join("; ") || "newsroom HTML unreachable";
  await writeSyncMeta(`error:${error.slice(0, 200)}`);
  const { logSystem } = await import("@/lib/syslog");
  await logSystem("warning", "irs_sync", "IRS update sync failed — newsroom unreachable from this host", {
    urls,
    pageErrors,
  });
  return { fetched: 0, upserted: 0, source: "none", pages: 0, error };
}

export async function listPublishedUpdates(take = 50) {
  return db.agencyUpdate.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take,
  });
}

/** Public /irs-updates list: all published releases (sync keeps current + previous week covered). */
export async function listPublishedUpdatesForListing(take = 200) {
  return listPublishedUpdates(take);
}

export async function getPublishedUpdateBySlug(slug: string) {
  return db.agencyUpdate.findFirst({ where: { slug, isPublished: true } });
}
