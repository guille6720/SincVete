import { isLegacyPlanKey } from '../constants/features';
import type { SubscriptionStatus } from './resolve';

/**
 * Lead time for the trial-ending notice.
 * Not the trial duration — that stays in plans.metadata.default_trial_days / trial_ends_at.
 */
export const COMMERCIAL_TRIAL_REMIND_DAYS = 3;

/** Warn when metered usage reaches this fraction of a finite limit. */
export const COMMERCIAL_QUOTA_WARN_RATIO = 0.8;

export const PLAN_BILLING_HREF = '/configuracion?tab=plan';

export function isTrialEndingSoon(params: {
  trialEndsAt?: string | null;
  now?: Date;
  remindDays?: number;
}): boolean {
  if (!params.trialEndsAt) return false;
  const ends = new Date(params.trialEndsAt).getTime();
  if (!Number.isFinite(ends)) return false;
  const now = (params.now ?? new Date()).getTime();
  if (ends <= now) return false;
  const days = params.remindDays ?? COMMERCIAL_TRIAL_REMIND_DAYS;
  const windowMs = Math.max(days, 1) * 24 * 60 * 60 * 1000;
  return ends - now <= windowMs;
}

export function isQuotaNearLimit(params: {
  used: number;
  limit: number | null;
  ratio?: number;
}): boolean {
  if (params.limit === null || params.limit <= 0) return false;
  if (!Number.isFinite(params.used) || params.used < 0) return false;
  const ratio = params.ratio ?? COMMERCIAL_QUOTA_WARN_RATIO;
  return params.used >= Math.ceil(params.limit * ratio);
}

export function canCancelOwnSubscription(params: {
  planKey?: string | null;
  status?: SubscriptionStatus | null;
}): boolean {
  if (!params.planKey || isLegacyPlanKey(params.planKey)) return false;
  return params.status === 'trialing' || params.status === 'active' || params.status === 'past_due';
}

export function authorizeCronSecret(params: {
  authorizationHeader?: string | null;
  cronSecretHeader?: string | null;
  secret?: string | null;
}): boolean {
  const secret = params.secret?.trim() ?? '';
  if (!secret) return false;
  const header = params.authorizationHeader ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || (params.cronSecretHeader ?? '').trim();
  if (!token || token.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i += 1) {
    mismatch |= secret.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}
