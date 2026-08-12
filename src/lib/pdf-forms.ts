import "server-only";
import { PDFDocument, PDFTextField, PDFCheckBox, StandardFonts } from "pdf-lib";
import type { IrsFormTemplate } from "@prisma/client";
import { db } from "./db";
import { readUpload, saveUploadBuffer } from "./uploads";
import { logSystem } from "./syslog";

// Official IRS PDF infusion. Each form template can carry the URL of the real
// IRS PDF (e.g. https://www.irs.gov/pub/irs-pdf/f9465.pdf) plus an
// admin-editable mapping from wizard answer keys to the PDF's AcroForm field
// names. On download, the customer's answers are written into the official
// form — never a homemade layout.

export type PdfMapEntry = {
  field: string; // AcroForm field name, e.g. topmostSubform[0].Page1[0].f1_3[0]
  source?: string; // wizard answer key
  join?: string[]; // multiple answer keys joined with ", "
  const?: string; // fixed value
  expr?: string; // arithmetic over answer keys, e.g. "(amount_owed - down_payment) / 72"
  transform?:
    | "first_words"
    | "last_word"
    | "street"
    | "city_state_zip"
    | "city"
    | "state"
    | "zip"
    | "money"
    | "first_year"
    | "ssn_first3"
    | "ssn_mid2"
    | "ssn_last4";
  checkIf?: string; // makes the entry a checkbox: check when the value equals this
};

// Download (and cache) the official PDF for a template.
export async function ensureOfficialPdf(template: IrsFormTemplate): Promise<Buffer | null> {
  if (template.pdfPath) {
    try {
      return await readUpload(template.pdfPath);
    } catch {
      /* cached copy lost — refetch below */
    }
  }
  if (!template.pdfSourceUrl) return null;
  try {
    const res = await fetch(template.pdfSourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) throw new Error("Response is not a PDF");
    const name = await saveUploadBuffer(buf, ".pdf");
    await db.irsFormTemplate.update({ where: { id: template.id }, data: { pdfPath: name } });
    return buf;
  } catch (err) {
    await logSystem("error", "pdf_form", `Failed to fetch official PDF for Form ${template.formNumber}`, `${template.pdfSourceUrl}: ${String(err)}`);
    return null;
  }
}

export async function listPdfFields(pdfBytes: Buffer): Promise<{ name: string; type: string }[]> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return doc
    .getForm()
    .getFields()
    .map((f) => ({
      name: f.getName(),
      type: f instanceof PDFCheckBox ? "checkbox" : f instanceof PDFTextField ? "text" : f.constructor.name.replace("PDF", "").toLowerCase(),
    }));
}

function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Tiny arithmetic evaluator over answer keys: + - * / ( ) only.
function evalExpr(expr: string, data: Record<string, string>): number | null {
  const substituted = expr.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (k) => String(toNumber(data[k])));
  if (!/^[\d\s+\-*/().]+$/.test(substituted)) return null;
  try {
    const result = new Function(`"use strict"; return (${substituted});`)() as unknown;
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function applyTransform(value: string, transform: PdfMapEntry["transform"]): string {
  switch (transform) {
    case "first_words": {
      const parts = value.trim().split(/\s+/);
      return parts.slice(0, -1).join(" ") || value.trim();
    }
    case "last_word": {
      const parts = value.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : "";
    }
    case "street":
      return value.split(",")[0]?.trim() ?? value;
    case "city_state_zip":
      return value.split(",").slice(1).join(",").trim();
    case "city":
      return value.split(",")[1]?.trim() ?? "";
    case "state": {
      const rest = value.split(",").slice(1).join(",");
      return rest.match(/\b[A-Z]{2}\b/)?.[0] ?? "";
    }
    case "zip":
      return value.match(/\b\d{5}(-\d{4})?\b/)?.[0] ?? "";
    case "money": {
      const n = toNumber(value);
      return n > 0 ? money(n) : value;
    }
    case "first_year":
      return value.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
    case "ssn_first3":
      return value.replace(/\D/g, "").slice(0, 3);
    case "ssn_mid2":
      return value.replace(/\D/g, "").slice(3, 5);
    case "ssn_last4":
      return value.replace(/\D/g, "").slice(5, 9);
    default:
      return value;
  }
}

/**
 * Fill the official IRS PDF with the customer's wizard answers.
 * Returns the filled PDF, or null when no official PDF/mapping is configured
 * (callers fall back to the text worksheet).
 */
export async function fillOfficialPdf(
  template: IrsFormTemplate,
  data: Record<string, string>,
): Promise<Buffer | null> {
  let map: PdfMapEntry[] = [];
  try {
    const parsed = JSON.parse(template.pdfMapJson || "[]");
    if (Array.isArray(parsed)) map = parsed.filter((e) => e?.field);
  } catch {
    await logSystem("error", "pdf_form", `Form ${template.formNumber}: PDF field mapping is not valid JSON`);
    return null;
  }
  if (map.length === 0) return null;
  const pdfBytes = await ensureOfficialPdf(template);
  if (!pdfBytes) return null;

  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const problems: string[] = [];

    for (const entry of map) {
      try {
        let value: string;
        if (entry.const !== undefined) value = entry.const;
        else if (entry.expr) {
          const n = evalExpr(entry.expr, data);
          if (n === null || n === 0) continue; // don't print zeros on optional lines
          value = money(Math.round(n * 100) / 100);
        } else if (entry.join) {
          value = entry.join.map((k) => data[k] ?? "").filter(Boolean).join(", ");
        } else {
          value = data[entry.source ?? ""] ?? "";
        }
        if (entry.transform) value = applyTransform(value, entry.transform);
        if (!value && entry.checkIf === undefined) continue;

        if (entry.checkIf !== undefined) {
          // Never uncheck on mismatch: boxes start unchecked, and multiple
          // entries may target one box with different qualifying values (OR).
          if (value === entry.checkIf) form.getCheckBox(entry.field).check();
        } else {
          form.getTextField(entry.field).setText(value);
        }
      } catch (err) {
        problems.push(`${entry.field}: ${String(err instanceof Error ? err.message : err).slice(0, 120)}`);
      }
    }

    try {
      const helv = await doc.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(helv);
    } catch {
      /* appearance refresh is best-effort */
    }

    if (problems.length) {
      await logSystem("warning", "pdf_form", `Form ${template.formNumber}: ${problems.length} PDF field(s) could not be filled`, problems.join("\n"));
    }
    return Buffer.from(await doc.save());
  } catch (err) {
    await logSystem("error", "pdf_form", `Form ${template.formNumber}: failed to fill the official PDF`, String(err));
    return null;
  }
}
