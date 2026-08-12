import "server-only";
import { db } from "./db";
import { readUpload } from "./uploads";
import { getSetting } from "./settings";
import { formatCaseNumber } from "./case-number";

// Generates the full case report: a self-contained, print-ready HTML document
// (browser "Print → Save as PDF" produces the PDF) with every issue, step,
// deadline, letter, and copies of the case's readable/imageable documents
// merged in as appendices.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const usd = (cents: number | null) =>
  cents === null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export async function buildCaseReportHtml(caseId: string): Promise<{ html: string; fileName: string } | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, address: true } },
      issues: { orderBy: { createdAt: "asc" } },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
      deadlines: { orderBy: { dueDate: "asc" } },
      letters: { orderBy: { createdAt: "asc" } },
      notices: { orderBy: { createdAt: "asc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 1, include: { stepResults: { select: { id: true } } } },
    },
  });
  if (!c) return null;
  const appName = await getSetting("app.name", "TaxOnMe");
  const ref = formatCaseNumber(c.number);
  const generatedAt = new Date().toLocaleString("en-US");
  const reviewLevel = c.runs[0]?.stepResults.length ? "Full analysis" : "Preliminary review";

  // Merge document copies: images embedded inline, text embedded as content,
  // everything else referenced in the appendix inventory.
  const docSections: string[] = [];
  for (const [i, d] of c.documents.entries()) {
    const header = `<h3>Appendix ${String.fromCharCode(65 + (i % 26))} — ${esc(d.fileName)} <span class="muted">(${d.docKind}, uploaded ${d.uploadedAt.toLocaleDateString("en-US")})</span></h3>`;
    try {
      if (d.mimeType.startsWith("image/") && d.sizeBytes < 8 * 1024 * 1024) {
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<img class="doc" src="data:${d.mimeType};base64,${buf.toString("base64")}" alt="${esc(d.fileName)}" />`);
        continue;
      }
      if (d.mimeType.startsWith("text/") || /\.(txt|csv|md|log)$/i.test(d.fileName)) {
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<pre class="doc-text">${esc(buf.toString("utf-8").slice(0, 20000))}</pre>`);
        continue;
      }
      docSections.push(`${header}<p class="muted">Binary document (${d.mimeType}, ${(d.sizeBytes / 1024).toFixed(0)} KB) — stored in the ${appName} vault; attach the original file when sharing this report.</p>`);
    } catch {
      docSections.push(`${header}<p class="muted">Document could not be read for embedding.</p>`);
    }
  }

  const stateLabel: Record<string, string> = {
    resolved: "Resolved", review: "Review", action_needed: "Action needed", urgent: "Urgent", info_needed: "Information needed",
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(appName)} Case Report ${ref}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.55; }
  header { border-bottom: 3px solid #4338ca; padding-bottom: 16px; margin-bottom: 28px; }
  h1 { font-size: 26px; margin: 0; color: #1e1b4b; }
  h2 { font-size: 18px; color: #4338ca; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 32px; }
  h3 { font-size: 15px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 8px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .muted { color: #94a3b8; font-size: 12px; font-weight: normal; }
  .meta { font-size: 13px; color: #475569; margin-top: 6px; }
  .badge { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 1px 10px; font-size: 11px; margin-right: 6px; }
  .amounts { display: flex; gap: 24px; margin: 8px 0; }
  .amounts div { text-align: center; }
  .amounts .n { font-size: 18px; font-weight: bold; }
  img.doc { max-width: 100%; border: 1px solid #e2e8f0; margin: 8px 0; }
  pre.doc-text { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; font-size: 11px; white-space: pre-wrap; font-family: 'Courier New', monospace; }
  pre.letter { background: #fff; border: 1px solid #e2e8f0; padding: 16px; font-size: 12px; white-space: pre-wrap; font-family: 'Courier New', monospace; }
  footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 0; } h2 { page-break-after: avoid; } .appendix { page-break-before: always; } }
</style>
</head>
<body>
<header>
  <h1>${esc(appName)} — Case Report</h1>
  <p class="meta">
    <strong>Case reference:</strong> ${ref} &nbsp;·&nbsp; <strong>Generated:</strong> ${generatedAt}<br/>
    <strong>Taxpayer:</strong> ${esc(`${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim() || "—")} (${esc(c.user?.email ?? "—")}${c.user?.phone ? `, ${esc(c.user.phone)}` : ""})${c.user?.address ? `<br/><strong>Address:</strong> ${esc(c.user.address)}` : ""}<br/>
    <strong>Case opened:</strong> ${c.createdAt.toLocaleDateString("en-US")} &nbsp;·&nbsp; <strong>Status:</strong> ${esc(c.status.replace(/_/g, " "))} &nbsp;·&nbsp; <strong>Readiness:</strong> ${c.readinessScore}% &nbsp;·&nbsp; <strong>Review level:</strong> ${reviewLevel}
  </p>
</header>

<h2>1. Situation as reported</h2>
<p>${esc(c.situation)}</p>
<h2>2. Taxpayer's goal</h2>
<p>${esc(c.goal || "—")}</p>

<h2>3. Issues identified (${c.issues.length})</h2>
${c.issues
  .map(
    (i, n) => {
      let unclear: string[] = [];
      try { const p = JSON.parse(i.unclearJson || "[]"); if (Array.isArray(p)) unclear = p.map(String).filter(Boolean); } catch { /* legacy */ }
      const statusLabel: Record<string, string> = { confirmed: "Confirmed", likely: "Likely", possible: "Possible", needs_verification: "Needs verification", not_supported: "Not supported" };
      const kindLabel: Record<string, string> = { finding: "Finding", issue: "Issue", opportunity: "Opportunity", risk: "Risk", missing_info: "Missing information" };
      return `<h3>3.${n + 1} ${i.taxYear ? `${i.taxYear} · ` : ""}${esc(i.title)}</h3>
<p><span class="badge">${kindLabel[i.itemKind] ?? "Issue"}</span><span class="badge">${statusLabel[i.evidenceStatus] ?? "Needs verification"}</span><span class="badge">${stateLabel[i.state] ?? i.state}</span><span class="badge">Evidence: ${i.evidenceStrength}</span><span class="badge">Priority: ${i.priority}</span><span class="badge">Type: ${i.issueType.replace(/_/g, " ")}</span></p>
${i.expectedCents !== null || i.differenceCents !== null ? `<div class="amounts"><div><div class="muted">Expected</div><div class="n">${usd(i.expectedCents)}</div></div><div><div class="muted">Received/assessed</div><div class="n">${usd(i.receivedCents)}</div></div><div><div class="muted">Difference</div><div class="n">${usd(i.differenceCents)}</div></div></div>` : ""}
<p>${esc(i.description)}</p>
${i.conclusion ? `<p><strong>Conclusion:</strong> ${esc(i.conclusion)}</p>` : ""}
${unclear.length ? `<p><strong>Still unclear:</strong></p><ul>${unclear.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : ""}
${i.irsBasis ? `<p class="muted">IRS basis: ${esc(i.irsBasis)}</p>` : ""}
${i.nextAction ? `<p><strong>Recommended action:</strong> ${esc(i.nextAction.replace(/_/g, " ").toLowerCase())}</p>` : ""}`;
    },
  )
  .join("\n")}

<h2>4. Resolution path</h2>
<table><tr><th>#</th><th>Step</th><th>Status</th></tr>
${c.pathSteps.map((s, n) => `<tr><td>${n + 1}</td><td><strong>${esc(s.title)}</strong><br/><span class="muted">${esc(s.description)}</span></td><td>${s.status === "done" ? "✓ Completed" : s.status === "current" ? "▶ In progress" : "Pending"}</td></tr>`).join("\n")}
</table>

${c.deadlines.length ? `<h2>5. Deadlines</h2>
<table><tr><th>Deadline</th><th>Due date</th><th>Status</th></tr>
${c.deadlines.map((d) => `<tr><td>${esc(d.title)}</td><td>${d.dueDate.toLocaleDateString("en-US")}</td><td>${d.status}</td></tr>`).join("\n")}
</table>` : ""}

${c.notices.length ? `<h2>6. IRS notices on file</h2>
<table><tr><th>Notice</th><th>Tax year</th><th>Amount</th><th>Deadline</th></tr>
${c.notices.map((n) => `<tr><td>${esc(n.noticeType || "Unidentified")}</td><td>${n.taxYear ?? "—"}</td><td>${usd(n.amountCents)}</td><td>${n.deadline?.toLocaleDateString("en-US") ?? "—"}</td></tr>`).join("\n")}
</table>` : ""}

${c.letters.length ? `<h2>7. Response letters drafted</h2>
${c.letters.map((l) => `<h3>${esc(l.title)} <span class="muted">(${l.status}, ${l.createdAt.toLocaleDateString("en-US")})</span></h3><pre class="letter">${esc(l.body.slice(0, 6000))}</pre>`).join("\n")}` : ""}

<h2>8. Document inventory (${c.documents.length})</h2>
<table><tr><th>File</th><th>Type</th><th>Uploaded</th><th>Size</th></tr>
${c.documents.map((d) => `<tr><td>${esc(d.fileName)}</td><td>${d.docKind}</td><td>${d.uploadedAt.toLocaleDateString("en-US")}</td><td>${(d.sizeBytes / 1024).toFixed(0)} KB</td></tr>`).join("\n")}
</table>

${docSections.length ? `<div class="appendix"><h2>Appendices — document copies</h2>${docSections.join("\n")}</div>` : ""}

<footer>
  Report ${ref} generated by ${esc(appName)} on ${generatedAt}. ${esc(appName)} is a tax assistant, not the IRS, a CPA firm, or a law firm;
  this report summarizes the taxpayer's case records and analysis for personal or professional review. Verify amounts against official IRS records.
</footer>
</body>
</html>`;

  return { html, fileName: `${appName.replace(/\s+/g, "")}-case-report-${ref}.html` };
}
