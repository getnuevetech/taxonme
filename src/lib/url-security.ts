import "server-only";
import dns from "dns/promises";
import net from "net";

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

export async function validatePublicHttpsUrl(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Enter a valid URL.";
  }
  if (url.protocol !== "https:") return "Only HTTPS URLs are allowed.";
  if (url.username || url.password) return "URLs with embedded credentials are not allowed.";

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return "Localhost URLs are not allowed.";
  }

  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? "Private or loopback IP addresses are not allowed." : null;
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
      return "The URL resolves to a private or loopback address.";
    }
  } catch {
    return "The URL hostname could not be resolved.";
  }

  return null;
}

export async function validateOfficialIrsPdfUrl(rawUrl: string): Promise<string | null> {
  if (!rawUrl) return null;
  const publicError = await validatePublicHttpsUrl(rawUrl);
  if (publicError) return publicError;
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  if (hostname !== "www.irs.gov" && hostname !== "irs.gov") {
    return "Official IRS form PDFs must be hosted on irs.gov.";
  }
  if (!/\.pdf(?:$|[?#])/i.test(rawUrl)) return "Official IRS form URLs must point to a PDF.";
  return null;
}
