/**
 * Compatibility exports for Wave 4 callers. The implementation is the real
 * Wave 7 L0/L2 experience module; no local placeholder remains.
 */
export {
  buildLearningEvent,
  learningEventFromExperience,
  learningEventFromIntelligence,
  assertNoPrematureSchemaAsk,
} from "@/lib/experience/experience-record";
