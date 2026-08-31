export {
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  SCHEMA_DUMP_NEGATIVE_LESSON,
  SEEDED_NEGATIVE_LESSONS,
  findNegativeLessonsForDecisionTarget,
  isPrematureFinancialSchemaAsk,
} from "./negative-lessons";
export type { NegativeLesson } from "./negative-lessons";
export {
  buildExperienceRecord,
  buildLearningEvent,
  learningEventFromExperience,
  learningEventFromIntelligence,
  assertNoPrematureSchemaAsk,
} from "./experience-record";
export type {
  ExperienceRecordV0,
  ClarificationSelected,
} from "./experience-record";
export {
  extractSituationFeatures,
  clarificationFactKey,
  partitionWhatMattered,
  DISCARDED_EARLY_PATHWAY_FACTS,
} from "./what-mattered";
export type { WhatMatteredPartition } from "./what-mattered";
export {
  buildNegativeLearningRecords,
  hasNegativeLearningViolation,
  avoidedNegativeLessonIds,
} from "./negative-learning";
export type {
  NegativeLearningRecord,
  NegativeLearningEvaluation,
} from "./negative-learning";
export {
  applyConsultantCorrection,
  buildPatternCandidate,
  assertIsPatternCandidate,
  normalizeCorrectionInput,
  inferLessonId,
  isInstitutionalKey,
  PATTERN_CANDIDATE_LEVEL,
  CORRECTION_FAILURE_TYPES,
} from "./corrections";
export type {
  ConsultantCorrectionInput,
  CorrectionFailureType,
  ReviewerCorrection,
} from "./corrections";
export {
  deidentifyExperienceRecord,
  assertSafeForSharedExperience,
  textLooksLikePii,
  scrubFreeText,
  filterForCrossUserRead,
  sourceDigest,
} from "./deidentify";
export type {
  AnonymizedExperienceRecord,
  AnonymizedNegativeLearning,
  AnonymizedCorrection,
  AnonymizedOutcome,
  PromotionLevel,
} from "./deidentify";
export {
  applyGovernmentOutcome,
  buildOutcomePatternCandidate,
  assertIsOutcomeCandidate,
  checkOutcomeAuthority,
  normalizeOutcomeInput,
  authorityKeysRecognized,
  OUTCOME_KINDS,
  GOVERNMENT_SYSTEMS,
  ALLOWED_AUTHORITY_PUBLISHERS,
  OUTCOME_CANDIDATE_LEVEL,
} from "./outcomes";
export type {
  GovernmentOutcomeInput,
  OutcomeKind,
  GovernmentSystem,
  AuthorityCheckResult,
  AppliedGovernmentOutcome,
} from "./outcomes";
export {
  publishAnonymizedObservation,
  publishPatternCandidateFromCorrection,
  publishPatternCandidateFromOutcome,
  listSharedObservations,
  listPatternCandidates,
  listProductionPatterns,
} from "./publish";
export {
  PROMOTION_LABELS,
  PROMOTION_LEVELS,
  listRegistryEntries,
  countRegistryByLevel,
  setPatternPromotionLevel,
  canPromoteToProduction,
  validatePromotionTarget,
  parsePromotionLevel,
  isPromotionLevel,
} from "./registry";
export type { RegistryEntry } from "./registry";
export {
  searchProductionExperience,
  rankProductionPatterns,
  formatExperienceSearchBlock,
  buildExperienceSearchBlock,
  assertAllProductionLevel,
  productionPatternAskHints,
  EXPERIENCE_SEARCH_PRECEDENCE,
} from "./search";
export type {
  ExperienceSearchQuery,
  ExperienceSearchHit,
} from "./search";
export {
  recordPatternServed,
  recordPatternFeedback,
  markPatternStale,
  clearPatternStale,
  invalidatePatternsForAuthorityKey,
  shouldAutoStaleFromTelemetry,
  isActivelyServable,
  filterServableProductionRows,
  HARM_AUTO_STALE_MIN,
  HARM_AUTO_STALE_RATIO,
} from "./telemetry";
export type {
  TelemetryVerdict,
  PatternTelemetrySnapshot,
} from "./telemetry";
export {
  EXPERIENCE_CANONICAL_NARRATIVE,
  EXPERIENCE_FIXTURE_PACK,
  listExperienceFixtureIds,
  runExperienceFixture,
  runExperienceFixturePack,
} from "./fixture-pack";
export type {
  ExperiencePackFixture,
  ExperienceFixtureKind,
  ExperienceFixtureResult,
} from "./fixture-pack";
