/**
 * Package R — Admin ConversationIntelligence re-enrich (mutate).
 * Reuses Package I path only; fail-closed (no write on enrich/parse failure).
 */
import "server-only";
import { db } from "@/lib/db";
import {
  runConversationIntelligence,
  enrichIntelligenceWithReasoningModel,
  parseStoredIntelligence,
  priorContractFromStored,
} from "@/lib/conversation";

export type ReenrichKind = "situation" | "qa_thread" | "case";

export type ReenrichResult =
  | { ok: true; kind: ReenrichKind; id: string; intelligenceJson: string }
  | { ok: false; error: string };

export async function reenrichEntityIntelligence(opts: {
  kind: ReenrichKind;
  id: string;
}): Promise<ReenrichResult> {
  const id = opts.id.trim();
  if (!id) return { ok: false, error: "Missing entity id." };

  try {
    if (opts.kind === "situation") {
      const row = await db.situation.findUnique({ where: { id } });
      if (!row) return { ok: false, error: "Situation not found." };
      const message = (row.originalNarrative || row.title || "").trim();
      if (message.length < 5) {
        return { ok: false, error: "Situation has no narrative to re-enrich." };
      }
      const intelligenceJson = await buildEnrichedJson({
        message,
        goal: row.goal,
        priorRaw: row.intelligenceJson,
      });
      if (!intelligenceJson) {
        return { ok: false, error: "Re-enrich produced unparseable intelligence; left stored JSON unchanged." };
      }
      await db.situation.update({
        where: { id },
        data: {
          intelligenceJson,
          learningEventJson: JSON.stringify(
            parseStoredIntelligence(intelligenceJson)?.learning_event ?? {},
          ),
        },
      });
      return { ok: true, kind: "situation", id, intelligenceJson };
    }

    if (opts.kind === "qa_thread") {
      const row = await db.qaThread.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 40 },
        },
      });
      if (!row) return { ok: false, error: "QaThread not found." };
      const fromMessages = row.messages
        .map((m) => `${m.role}: ${m.content}`.trim())
        .filter(Boolean)
        .join("\n");
      const message = (fromMessages || row.title || "").trim();
      if (message.length < 5) {
        return { ok: false, error: "Q&A thread has no messages to re-enrich." };
      }
      const intelligenceJson = await buildEnrichedJson({
        message,
        goal: row.title,
        priorRaw: row.intelligenceJson,
      });
      if (!intelligenceJson) {
        return { ok: false, error: "Re-enrich produced unparseable intelligence; left stored JSON unchanged." };
      }
      await db.qaThread.update({
        where: { id },
        data: { intelligenceJson },
      });
      return { ok: true, kind: "qa_thread", id, intelligenceJson };
    }

    const row = await db.case.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Case not found." };
    const message = (row.situation || row.title || "").trim();
    if (message.length < 5) {
      return { ok: false, error: "Case has no situation narrative to re-enrich." };
    }
    const intelligenceJson = await buildEnrichedJson({
      message,
      goal: row.goal,
      priorRaw: row.intelligenceJson,
    });
    if (!intelligenceJson) {
      return { ok: false, error: "Re-enrich produced unparseable intelligence; left stored JSON unchanged." };
    }
    await db.case.update({
      where: { id },
      data: { intelligenceJson },
    });
    return { ok: true, kind: "case", id, intelligenceJson };
  } catch (err) {
    return {
      ok: false,
      error: `Re-enrich failed closed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function buildEnrichedJson(opts: {
  message: string;
  goal: string;
  priorRaw: string | null | undefined;
}): Promise<string | null> {
  const priorContract = priorContractFromStored(opts.priorRaw);
  const base = runConversationIntelligence({
    message: opts.message,
    goal: opts.goal,
    priorContract,
  });
  const enriched = await enrichIntelligenceWithReasoningModel(base, {
    message: opts.message,
    goal: opts.goal,
    priorContract,
  });
  const raw = JSON.stringify(enriched);
  if (!parseStoredIntelligence(raw)) return null;
  return raw;
}
