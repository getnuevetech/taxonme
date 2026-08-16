import "server-only";
import { db } from "./db";

export async function qaSuggestionsForUser(userId: string): Promise<string[]> {
  const c = await db.case.findFirst({
    where: { userId, status: { not: "closed" } },
    orderBy: { updatedAt: "desc" },
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      pathSteps: { where: { status: "current" }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
  if (!c) {
    return [
      "What should I do before responding to an IRS notice?",
      "Which documents should I upload first?",
      "How do I know if I need professional help?",
    ];
  }

  const suggestions: string[] = [];
  const issue = c.issues[0];
  if (issue) {
    suggestions.push(`What does "${issue.title}" mean for my case?`);
    try {
      const unclear = JSON.parse(issue.unclearJson || "[]");
      if (Array.isArray(unclear) && unclear[0]) suggestions.push(`How should I answer: ${String(unclear[0])}`);
    } catch { /* ignore malformed legacy issue data */ }
  }
  const step = c.pathSteps[0];
  if (step) suggestions.push(`What should I do for my next step: ${step.title}?`);
  suggestions.push(`Which document would help verify "${c.title.slice(0, 60)}"?`);

  return Array.from(new Set(suggestions)).slice(0, 3);
}
