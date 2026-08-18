import { isLegacyPlanKey, isPublicPricingPlanKey } from '../constants/features';
import type { SubscriptionStatus } from './resolve';

/**
 * Lead time for the trial-ending notice.
 * Not the trial duration — that stays in plans.metadata.default_trial_days / trial_ends_at.
 */
export const COMMERCIAL_TRIAL_REMIND_DAYS = 3;

/** Warn when metered usage reaches this fraction of a finite limit. */
export const COMMERCIAL_QUOTA_WARN_RATIO = 0.8;

/**
 * How long a started checkout stays “in progress”.
 * Not plan duration — Mercado Pago / Stripe still have to confirm the webhook.
 */
export const COMMERCIAL_CHECKOUT_INTENT_HOURS = 48;

export const PLAN_BILLING_HREF = '/configuracion?tab=plan';

export type CheckoutIntentKind = 'plan' | 'addon';

export type OpenCheckoutIntent = {
  kind: CheckoutIntentKind;
  targetKey: string;
};

export function resolveCheckoutIntentAction(params: {
  openIntents: Array<{ kind: string; targetKey: string }>;
  kind: CheckoutIntentKind;
  targetKey: string;
}): 'ok' | 'reuse' | 'blocked' {
  const match = params.openIntents.some(
    (item) => item.kind === params.kind && item.targetKey === params.targetKey
  );
  if (match) return 'reuse';
  if (params.kind === 'plan' && params.openIntents.some((item) => item.kind === 'plan')) {
    return 'blocked';
  }
  return 'ok';
}

export type AddonOfferState = 'available' | 'active' | 'included' | 'blocked';

export function isPeriodEndingSoon(params: {
  endsAt?: string | null;
  now?: Date;
  remindDays?: number;
}): boolean {
  if (!params.endsAt) return false;
  const ends = new Date(params.endsAt).getTime();
  if (!Number.isFinite(ends)) return false;
  const now = (params.now ?? new Date()).getTime();
  if (ends <= now) return false;
  const days = params.remindDays ?? COMMERCIAL_TRIAL_REMIND_DAYS;
  const windowMs = Math.max(days, 1) * 24 * 60 * 60 * 1000;
  return ends - now <= windowMs;
}

export function isTrialEndingSoon(params: {
  trialEndsAt?: string | null;
  now?: Date;
  remindDays?: number;
}): boolean {
  return isPeriodEndingSoon({
    endsAt: params.trialEndsAt,
    now: params.now,
    remindDays: params.remindDays,
  });
}

/** Active extras can be bought again to extend the grant (one-time checkout). */
export function canCheckoutAddonOffer(offerState: AddonOfferState): boolean {
  return offerState === 'available' || offerState === 'active';
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

export function canCancelOwnAddon(params: { status?: SubscriptionStatus | null }): boolean {
  return params.status === 'active';
}

/** One-time paid plans (MP / Stripe payment) can be bought again to extend ends_at. */
export function canRenewOwnPlan(params: {
  planKey?: string | null;
  status?: SubscriptionStatus | null;
  endsAt?: string | null;
}): boolean {
  if (!params.planKey || !isPublicPricingPlanKey(params.planKey)) return false;
  if (!params.endsAt) return false;
  return params.status === 'trialing' || params.status === 'active' || params.status === 'past_due';
}

export function resolveAddonOfferState(params: {
  planKey?: string | null;
  subscriptionOpen: boolean;
  addonActive: boolean;
  primaryFeatureEnabled: boolean;
}): AddonOfferState {
  if (params.addonActive) return 'active';
  if (isLegacyPlanKey(params.planKey ?? '') || params.primaryFeatureEnabled) return 'included';
  if (!params.subscriptionOpen) return 'blocked';
  return 'available';
}

export type ClinicCommercialBannerKind =
  | 'trial'
  | 'past_due'
  | 'expired'
  | 'plan_ending'
  | 'addon_ending'
  | 'checkout_pending'
  | 'quota_over'
  | 'quota_near';

export type ClinicCommercialBanner = {
  kind: ClinicCommercialBannerKind;
  planName: string | null;
  trialEndsAt: string | null;
  endsAt: string | null;
  addonName: string | null;
  quotaLabel?: string | null;
  quotaUsed?: number | null;
  quotaLimit?: number | null;
  quotaFeatureKey?: string | null;
};

export type ClinicSeatMeter = {
  featureKey?: string;
  label: string;
  used: number;
  limit: number | null;
};

export type ClinicCommercialBannerInput = {
  hasOpenSubscription: boolean;
  status?: SubscriptionStatus | null;
  planKey?: string | null;
  planName?: string | null;
  trialEndsAt?: string | null;
  endsAt?: string | null;
  latestClosedStatus?: 'expired' | 'cancelled' | null;
  latestClosedPlanName?: string | null;
  addonsEnding?: Array<{ name: string; endsAt: string }>;
  checkoutPending?: OpenCheckoutIntent | null;
  seats?: ClinicSeatMeter[];
  now?: Date;
};

function pickQuotaBannerSeat(
  seats: ClinicSeatMeter[] | undefined
): { over: boolean; label: string; used: number; limit: number; featureKey: string | null } | null {
  const finite = (seats ?? []).filter(
    (seat): seat is ClinicSeatMeter & { limit: number } =>
      seat.limit !== null && Number.isFinite(seat.limit) && seat.limit > 0
  );
  const ranked = (items: Array<ClinicSeatMeter & { limit: number }>) =>
    items
      .slice()
      .sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
  const over = ranked(finite.filter((seat) => seat.used > seat.limit));
  if (over) {
    return {
      over: true,
      label: over.label,
      used: over.used,
      limit: over.limit,
      featureKey: over.featureKey ?? null,
    };
  }
  const near = ranked(
    finite.filter(
      (seat) =>
        seat.used <= seat.limit && isQuotaNearLimit({ used: seat.used, limit: seat.limit })
    )
  );
  if (near) {
    return {
      over: false,
      label: near.label,
      used: near.used,
      limit: near.limit,
      featureKey: near.featureKey ?? null,
    };
  }
  return null;
}

/**
 * One sticky clinic banner. A checkout in flight beats renewal nags
 * so Mercado Pago one-time payers are not asked to charge twice.
 * Seat and metered quota are last. The cron already emits plan_quota; the clinic
 * should see occupancy and monthly meters without opening the notification bell.
 * Lead time is COMMERCIAL_TRIAL_REMIND_DAYS, not plan/add-on duration.
 */
export function resolveClinicCommercialBanner(
  input: ClinicCommercialBannerInput
): ClinicCommercialBanner | null {
  const planName = input.planName ?? null;
  if (input.checkoutPending) {
    return {
      kind: 'checkout_pending',
      planName,
      trialEndsAt: null,
      endsAt: null,
      addonName: null,
    };
  }
  if (
    !input.hasOpenSubscription &&
    (input.latestClosedStatus === 'expired' || input.latestClosedStatus === 'cancelled')
  ) {
    return {
      kind: 'expired',
      planName: input.latestClosedPlanName ?? planName,
      trialEndsAt: null,
      endsAt: null,
      addonName: null,
    };
  }
  if (input.hasOpenSubscription && input.status === 'past_due') {
    return {
      kind: 'past_due',
      planName,
      trialEndsAt: null,
      endsAt: input.endsAt ?? null,
      addonName: null,
    };
  }
  if (input.hasOpenSubscription && input.status === 'trialing') {
    return {
      kind: 'trial',
      planName,
      trialEndsAt: input.trialEndsAt ?? null,
      endsAt: input.trialEndsAt ?? null,
      addonName: null,
    };
  }
  if (
    input.hasOpenSubscription &&
    isPublicPricingPlanKey(input.planKey ?? '') &&
    isPeriodEndingSoon({ endsAt: input.endsAt, now: input.now })
  ) {
    return {
      kind: 'plan_ending',
      planName,
      trialEndsAt: null,
      endsAt: input.endsAt ?? null,
      addonName: null,
    };
  }
  const addon = (input.addonsEnding ?? [])
    .filter((item) => isPeriodEndingSoon({ endsAt: item.endsAt, now: input.now }))
    .slice()
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0];
  if (addon) {
    return {
      kind: 'addon_ending',
      planName,
      trialEndsAt: null,
      endsAt: addon.endsAt,
      addonName: addon.name,
    };
  }
  if (input.hasOpenSubscription && !isLegacyPlanKey(input.planKey ?? '')) {
    const seat = pickQuotaBannerSeat(input.seats);
    if (seat) {
      return {
        kind: seat.over ? 'quota_over' : 'quota_near',
        planName,
        trialEndsAt: null,
        endsAt: null,
        addonName: null,
        quotaLabel: seat.label,
        quotaUsed: seat.used,
        quotaLimit: seat.limit,
        quotaFeatureKey: seat.featureKey,
      };
    }
  }
  return null;
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
