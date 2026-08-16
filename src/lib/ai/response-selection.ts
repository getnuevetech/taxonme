import "server-only";

type Candidate = {
  text: string;
  source: string;
};

function terms(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 3),
  );
}

function scoreCandidate(candidate: Candidate, prompt: string, knowledge: string): number {
  const text = candidate.text.trim();
  if (!text) return Number.NEGATIVE_INFINITY;
  const lower = text.toLowerCase();
  let score = Math.min(text.length, 1800) / 40;

  const promptTerms = terms(prompt);
  const answerTerms = terms(text);
  for (const term of promptTerms) if (answerTerms.has(term)) score += 3;

  const codes = prompt.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}\b/g) ?? [];
  for (const code of codes) if (text.toUpperCase().includes(code.replace(/\s|-/g, ""))) score += 12;

  if (knowledge && /irs|form|notice|transcript|deadline|payment|penalt/i.test(text)) score += 8;
  if (/not (a|your) (cpa|attorney)|not the irs|licensed professional/i.test(text)) score += 4;
  if (/couldn'?t respond|try again|not available|i can'?t help/i.test(lower)) score -= 30;
  if (text.length < 60) score -= 8;
  if (text.length > 2200) score -= 8;

  return score;
}

export function selectBestResponse(candidates: Candidate[], prompt: string, knowledge = ""): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, prompt, knowledge);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
