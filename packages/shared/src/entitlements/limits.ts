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

/** Matches Postgres date_trunc('month', timezone('utc', now())). */
export function utcMonthPeriod(now = new Date()): { start: string; end: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export const METERED_USAGE_LABELS: Record<string, string> = {
  'ai.monthly_requests': 'IA clínica',
  'whatsapp.monthly_messages': 'WhatsApp',
  'storage.max_mb': 'Almacenamiento',
};

export type MeteredUsageMeter = {
  featureKey: string;
  label: string;
  used: number;
  limit: number | null;
};

export function formatMeteredUsage(meter: MeteredUsageMeter): string {
  const unit = meter.featureKey === 'storage.max_mb' ? ' MB' : '';
  if (meter.limit === null) return `${meter.used}${unit} / ilimitado`;
  if (meter.limit <= 0) return 'No incluido';
  return `${meter.used} / ${meter.limit}${unit}`;
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
