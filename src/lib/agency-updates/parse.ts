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

/** Best-effort scrape of USCIS newsroom list pages when RSS is blocked. */
export function parseUscisNewsroomHtml(html: string, baseUrl: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const seen = new Set<string>();
  // Prefer article-ish anchors under newsroom paths.
  const re = /<a[^>]+href=["'](\/newsroom\/[^"']+|https?:\/\/www\.uscis\.gov\/newsroom\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && items.length < 40) {
    const href = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).toString();
    const title = decodeXml(match[2]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 12) continue;
    if (/^(alerts|all news|newsroom|archive|subscribe)/i.test(title)) continue;
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
