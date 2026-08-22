export type ParsedFeedItem = {
  externalId: string;
  title: string;
  summary: string;
  body: string;
  sourceUrl: string;
  publishedAt: Date;
  tags: string[];
};

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, tag: string): string {
  const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"));
  if (cdata?.[1]) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain?.[1]?.trim() ?? "";
}

function parseDate(raw: string): Date {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Minimal RSS 2.0 / Atom parser — no external dependency. */
export function parseAgencyFeedXml(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const rssBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssBlocks) {
    const title = decodeXml(tagValue(block, "title"));
    const link = decodeXml(tagValue(block, "link") || tagValue(block, "guid"));
    const guid = decodeXml(tagValue(block, "guid") || link || title);
    const description = decodeXml(tagValue(block, "description") || tagValue(block, "content:encoded"));
    const pubDate = tagValue(block, "pubDate") || tagValue(block, "dc:date");
    if (!title || !guid) continue;
    items.push({
      externalId: guid.slice(0, 500),
      title: title.slice(0, 300),
      summary: description.slice(0, 500),
      body: description.slice(0, 8000),
      sourceUrl: link.slice(0, 1000),
      publishedAt: parseDate(pubDate),
      tags: [],
    });
  }

  if (items.length) return items;

  const atomBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomBlocks) {
    const title = decodeXml(tagValue(block, "title"));
    const id = decodeXml(tagValue(block, "id") || title);
    const linkMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = decodeXml(linkMatch?.[1] ?? "");
    const summary = decodeXml(tagValue(block, "summary") || tagValue(block, "content"));
    const published = tagValue(block, "published") || tagValue(block, "updated");
    if (!title || !id) continue;
    items.push({
      externalId: id.slice(0, 500),
      title: title.slice(0, 300),
      summary: summary.slice(0, 500),
      body: summary.slice(0, 8000),
      sourceUrl: link.slice(0, 1000),
      publishedAt: parseDate(published),
      tags: [],
    });
  }
  return items;
}

function parseIrsReleaseDate(raw: string): Date | null {
  const m = raw.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\b/i);
  if (!m) return null;
  const d = new Date(m[0]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * IRS newsroom list pages (e.g. news-releases-for-current-month) expose each
 * release as an h2 bookmark link plus a nearby IR-YYYY-N abstract.
 */
export function parseIrsNewsroomHtml(html: string, baseUrl: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const seen = new Set<string>();
  const cardRe =
    /<h2>\s*<a[^>]+href=["']([^"']+)["'][^>]*>\s*(?:<span>)?([\s\S]*?)(?:<\/span>)?\s*<\/a>\s*<\/h2>[\s\S]{0,800}?field__item">([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = cardRe.exec(html)) && items.length < 40) {
    const href = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).toString();
    const title = decodeXml(match[2]).replace(/\s+/g, " ").trim();
    const abstract = decodeXml(match[3]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 8) continue;
    if (/^(newsroom|subscribe|archive|topics in the news)$/i.test(title)) continue;
    if (/\b(archive|subscribe|topics in the news)\b/i.test(title) && !/\bIR-\d{4}-\d+\b/i.test(abstract)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const ir = abstract.match(/\bIR-\d{4}-\d+\b/);
    items.push({
      externalId: ir?.[0] ?? href,
      title: title.slice(0, 300),
      summary: abstract.slice(0, 500),
      body: abstract.slice(0, 8000),
      sourceUrl: href.slice(0, 1000),
      publishedAt: parseIrsReleaseDate(abstract) ?? new Date(),
      tags: ir ? [ir[0]] : ["newsroom"],
    });
  }

  if (items.length) return items;

  // Fallback: any newsroom article link with a meaningful title.
  const re = /<a[^>]+href=["'](\/newsroom\/[^"']+|https?:\/\/www\.irs\.gov\/newsroom\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = re.exec(html)) && items.length < 40) {
    const href = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).toString();
    const title = decodeXml(match[2]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 12) continue;
    if (/^(newsroom|news releases|subscribe|archive|topics|fact sheets)/i.test(title)) continue;
    if (/\b(archive|subscribe|fact sheet archive)\b/i.test(title)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    items.push({
      externalId: href,
      title: title.slice(0, 300),
      summary: title.slice(0, 500),
      body: title.slice(0, 8000),
      sourceUrl: href,
      publishedAt: new Date(),
      tags: ["newsroom"],
    });
  }
  return items;
}

export function slugifyUpdateTitle(title: string, externalId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const hash = Buffer.from(externalId).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `${base || "update"}-${hash || "x"}`;
}
