/**
 * Soft invalidation: when evidence changes, mark customer output stale
 * until the next compile / approve cycle.
 */

export type InvalidationState = {
  customerOutputStale: boolean;
  invalidationPendingAt: string | null;
  invalidationReason: string | null;
};

export function emptyInvalidation(): InvalidationState {
  return { customerOutputStale: false, invalidationPendingAt: null, invalidationReason: null };
}

export function markStaleAfterEvidenceChange(
  reason: string,
  coalesceMs = 30_000,
  previous?: InvalidationState | null,
): InvalidationState {
  const now = Date.now();
  const prevAt = previous?.invalidationPendingAt ? Date.parse(previous.invalidationPendingAt) : 0;
  if (previous?.customerOutputStale && prevAt && now - prevAt < coalesceMs) {
    return {
      customerOutputStale: true,
      invalidationPendingAt: previous.invalidationPendingAt,
      invalidationReason: previous.invalidationReason ?? reason,
    };
  }
  return {
    customerOutputStale: true,
    invalidationPendingAt: new Date(now).toISOString(),
    invalidationReason: reason,
  };
}

export function clearInvalidation(): InvalidationState {
  return emptyInvalidation();
}
