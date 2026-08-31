/**
 * Matter-type lock + three locks (retrieval / presentation / recommendation).
 * Tax rewrite of Imm case-type-lock — collections/exam/CP2000 isolation.
 */

export type MatterTypeLock = {
  /** Primary tax module / pathway id (e.g. cp2000_underreporter, collection_levy). */
  primaryModule: string | null;
  relatedModule: string | null;
  doNotRecommendNewPathway: boolean;
  /** When true, installment/CNC/OIC options exploration is allowed. */
  lockOpenReliefOptions: boolean;
  matterType?: string;
};

/** Competing starter pathways that must not displace a locked agency matter. */
const COMPETING_PATHWAYS = new Set([
  "new_1040_filing",
  "amended_return_first",
  "offer_in_compromise_cold_start",
  "state_only_response",
]);

/** Themes that pull unrelated exam/education content into collections matters. */
const EXAM_ONLY_THEMES = new Set(["audit_exam_education", "schedule_c_audit"]);

export function matterTypeLockFromBrief(
  brief: {
    primaryModule?: string | null;
    relatedModule?: string | null;
    doNotRecommendNewPathway?: boolean;
    lockOpenReliefOptions?: boolean;
    matterType?: string;
  } | null | undefined,
): MatterTypeLock | null {
  if (!brief) return null;
  const primaryModule = brief.primaryModule?.trim() || null;
  const relatedModule = brief.relatedModule?.trim() || null;
  if (
    !primaryModule &&
    !relatedModule &&
    !brief.doNotRecommendNewPathway &&
    !brief.lockOpenReliefOptions
  ) {
    return null;
  }
  return {
    primaryModule,
    relatedModule,
    doNotRecommendNewPathway: Boolean(brief.doNotRecommendNewPathway),
    lockOpenReliefOptions: Boolean(brief.lockOpenReliefOptions),
    matterType: brief.matterType,
  };
}

export function lockedModules(lock: MatterTypeLock | null | undefined): string[] {
  if (!lock) return [];
  const out: string[] = [];
  for (const value of [lock.primaryModule, lock.relatedModule]) {
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

export function isCollectionsLevyLock(lock: MatterTypeLock | null | undefined): boolean {
  if (!lock) return false;
  const mods = lockedModules(lock);
  return mods.includes("collection_levy") || /\blevy|collection\b/i.test(lock.matterType ?? "");
}

export function isCp2000Lock(lock: MatterTypeLock | null | undefined): boolean {
  if (!lock) return false;
  const mods = lockedModules(lock);
  return mods.includes("cp2000_underreporter") || /\bcp\s?-?2000\b/i.test(lock.matterType ?? "");
}

export function isCompetingPathway(
  pathwayId: string | null | undefined,
  lock: MatterTypeLock | null | undefined,
): boolean {
  if (!lock?.doNotRecommendNewPathway) return false;
  const id = String(pathwayId ?? "");
  if (!COMPETING_PATHWAYS.has(id)) return false;
  return !lockedModules(lock).includes(id);
}

export function scopeInquiryThemes<T extends string>(themes: T[], lock: MatterTypeLock | null | undefined): T[] {
  if (!lock?.doNotRecommendNewPathway) return themes;
  if (!isCollectionsLevyLock(lock)) return themes;
  const filtered = themes.filter((theme) => !EXAM_ONLY_THEMES.has(theme));
  return filtered.length ? filtered : themes;
}

/** Contaminating phrases forbidden in collections customer copy. */
export const COLLECTIONS_CONTAMINATION_PHRASES = [
  "file a new Form 1040 first",
  "Schedule C audit workbook",
] as const;

export function passesRetrievalLock(text: string, lock: MatterTypeLock | null | undefined): boolean {
  if (!lock?.doNotRecommendNewPathway) return true;
  const hay = text;
  if (isCollectionsLevyLock(lock)) {
    if (/schedule\s*c\s+audit workbook/i.test(hay)) return false;
    if (/file a new Form 1040 first/i.test(hay)) return false;
    if (/\baudit exam education\b/i.test(hay) && !/\blevy|collection|installment\b/i.test(hay)) return false;
  }
  if (isCp2000Lock(lock)) {
    if (/offer in compromise cold start/i.test(hay) && !/\bcp\s?-?2000\b/i.test(hay)) return false;
  }
  return true;
}

export function filterByRetrievalLock<T>(
  items: T[],
  lock: MatterTypeLock | null | undefined,
  textOf: (item: T) => string,
): T[] {
  if (!lock?.doNotRecommendNewPathway) return items;
  return items.filter((item) => passesRetrievalLock(textOf(item), lock));
}

export function passesPresentationLock(text: string, lock: MatterTypeLock | null | undefined): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const phrase of COLLECTIONS_CONTAMINATION_PHRASES) {
    if (t.includes(phrase)) return false;
  }
  if (!lock?.doNotRecommendNewPathway) return true;
  if (isCollectionsLevyLock(lock)) {
    if (/file a new Form 1040 first/i.test(t)) return false;
    if (/Schedule C audit workbook/i.test(t)) return false;
  }
  return true;
}

export function scrubPresentationContamination(text: string): string {
  let out = text;
  for (const phrase of COLLECTIONS_CONTAMINATION_PHRASES) {
    out = out.split(phrase).join("");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function passesRecommendationLock(text: string, lock: MatterTypeLock | null | undefined): boolean {
  if (!lock?.doNotRecommendNewPathway) return true;
  const t = text.trim();
  if (!t) return false;
  if (/do not (?:treat|start|file)|instead of (?:filing|starting)|not recommended as a new/i.test(t)) {
    return true;
  }
  if (isCollectionsLevyLock(lock)) {
    if (/file (?:a |an )?new (?:form )?1040 first|start with an amended return/i.test(t)) return false;
  }
  if (isCp2000Lock(lock)) {
    if (/start with an offer in compromise before responding to the CP2000/i.test(t)) return false;
  }
  return true;
}

export function shouldEmitAntiNew1040(input: {
  lock: MatterTypeLock | null | undefined;
  hasNew1040ContaminationRisk: boolean;
}): boolean {
  if (!input.hasNew1040ContaminationRisk) return false;
  const lock = input.lock;
  if (!lock?.doNotRecommendNewPathway) return false;
  return isCollectionsLevyLock(lock) || isCp2000Lock(lock);
}

export function detectNew1040ContaminationRisk(texts: string[]): boolean {
  const blob = texts.join("\n");
  return (
    /file (?:a |an )?new (?:form )?1040/i.test(blob) ||
    /amended return first/i.test(blob) ||
    /start over with a fresh return/i.test(blob)
  );
}
