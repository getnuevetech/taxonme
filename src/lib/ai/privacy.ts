import crypto from "crypto";

const REDACTIONS: { pattern: RegExp; replacement: string }[] = [
  // SSN / ITIN style identifiers, with or without dashes.
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: "[REDACTED_TIN]" },
  // EIN style identifiers.
  { pattern: /\b\d{2}-\d{7}\b/g, replacement: "[REDACTED_EIN]" },
  // Long account/control numbers. Short tax years and dollar amounts are preserved.
  { pattern: /\b\d{9,20}\b/g, replacement: "[REDACTED_ACCOUNT_ID]" },
  // Label-led sensitive fields often include punctuation or spaces.
  { pattern: /\b(SSN|TIN|ITIN|EIN|account\s*(number|no\.?)|taxpayer\s*id)\s*[:#-]?\s*[A-Z0-9 -]{4,24}/gi, replacement: "$1: [REDACTED_IDENTIFIER]" },
];

export function redactSensitiveText(value: string): string {
  return REDACTIONS.reduce((text, rule) => text.replace(rule.pattern, rule.replacement), value);
}

export function redactPromptVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, redactSensitiveText(String(value ?? ""))]),
  );
}

export function sourceSnapshotId(sourceContext: string): string {
  const normalized = redactSensitiveText(sourceContext).trim();
  if (!normalized || normalized === "(none)" || normalized.startsWith("(no matching")) return "";
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}
