import { FEATURES, type FeatureKey } from '../constants/features';
import type { ClinicalAiKind } from '../constants/clinical-ai';

const BYTES_PER_MB = 1024 * 1024;

/** Metered storage is counted in whole MB; any positive upload consumes at least 1. */
export function bytesToStorageMb(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.max(1, Math.ceil(bytes / BYTES_PER_MB));
}

export function clinicalAiKindFeature(kind: ClinicalAiKind): FeatureKey {
  if (kind === 'soap_assist') return FEATURES.AI_SOAP_ASSISTANT;
  if (kind === 'owner_instructions') return FEATURES.AI_OWNER_INSTRUCTIONS;
  return FEATURES.AI_PATIENT_SUMMARY;
}

/**
 * Limit convention: null = unlimited, 0 = unavailable, positive = max.
 * Returns true when the next increment would not be allowed.
 */
export function wouldExceedLimit(
  currentCount: number,
  increment: number,
  limit: number | null
): boolean {
  if (limit === null) return false;
  if (!Number.isFinite(currentCount) || !Number.isFinite(increment) || currentCount < 0 || increment <= 0) {
    return true;
  }
  if (limit <= 0) return true;
  return currentCount + increment > limit;
}
