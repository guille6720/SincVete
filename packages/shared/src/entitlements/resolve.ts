import type { FeatureKey } from '../constants/features';
import { isFeatureKey, isLimitFeatureKey } from '../constants/features';

export type EntitlementSource = 'override' | 'plan' | 'default' | 'deny';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

export interface FeatureCatalogRow {
  key: string;
  featureType: 'boolean' | 'limit';
  defaultEnabled: boolean;
  defaultLimit: number | null;
  isActive: boolean;
}

export interface PlanFeatureRow {
  featureKey: string;
  enabled: boolean;
  /** null = unlimited for limit features */
  limitValue: number | null;
}

export interface FeatureOverrideRow {
  featureKey: string;
  enabled: boolean | null;
  limitValue: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface ResolvedEntitlement {
  enabled: boolean;
  /**
   * Limit convention:
   * - null = unlimited (when enabled)
   * - 0 = unavailable / no quota
   * - positive = maximum allowed
   */
  limit: number | null;
  source: EntitlementSource;
}

export type OrganizationEntitlements = Record<string, ResolvedEntitlement>;

export interface EntitlementResolutionInput {
  now?: Date;
  features: FeatureCatalogRow[];
  planFeatures: PlanFeatureRow[];
  overrides: FeatureOverrideRow[];
  /** When false/missing active subscription, only defaults apply then deny */
  hasActiveSubscription: boolean;
}

function isOverrideActive(row: FeatureOverrideRow, now: Date): boolean {
  if (row.startsAt) {
    const start = new Date(row.startsAt);
    if (!Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
      return false;
    }
  }
  if (row.endsAt) {
    const end = new Date(row.endsAt);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
      return false;
    }
  }
  return true;
}

function deny(): ResolvedEntitlement {
  return { enabled: false, limit: 0, source: 'deny' };
}

/**
 * Resolve a single feature.
 * Order: active override → plan → feature default → deny.
 * Unknown feature keys always deny.
 */
export function resolveFeatureEntitlement(
  featureKey: string,
  input: EntitlementResolutionInput
): ResolvedEntitlement {
  if (!isFeatureKey(featureKey)) {
    return deny();
  }

  const now = input.now ?? new Date();
  const catalog = input.features.find((f) => f.key === featureKey);
  if (!catalog || !catalog.isActive) {
    return deny();
  }

  const override = input.overrides.find(
    (o) => o.featureKey === featureKey && isOverrideActive(o, now)
  );

  if (override) {
    const enabled =
      override.enabled === null
        ? catalog.featureType === 'limit'
          ? true
          : catalog.defaultEnabled
        : override.enabled;

    if (!enabled) {
      return { enabled: false, limit: 0, source: 'override' };
    }

    if (catalog.featureType === 'limit' || isLimitFeatureKey(featureKey)) {
      const limit =
        override.limitValue !== null && override.limitValue !== undefined
          ? Number(override.limitValue)
          : catalog.defaultLimit;
      return {
        enabled: true,
        limit: limit === null || limit === undefined ? null : Number(limit),
        source: 'override',
      };
    }

    return { enabled: true, limit: null, source: 'override' };
  }

  if (input.hasActiveSubscription) {
    const planRow = input.planFeatures.find((p) => p.featureKey === featureKey);
    if (planRow) {
      if (!planRow.enabled) {
        return { enabled: false, limit: 0, source: 'plan' };
      }
      if (catalog.featureType === 'limit' || isLimitFeatureKey(featureKey)) {
        return {
          enabled: true,
          limit:
            planRow.limitValue === null || planRow.limitValue === undefined
              ? null
              : Number(planRow.limitValue),
          source: 'plan',
        };
      }
      return { enabled: true, limit: null, source: 'plan' };
    }
  }

  // Feature default
  if (catalog.defaultEnabled) {
    if (catalog.featureType === 'limit' || isLimitFeatureKey(featureKey)) {
      return {
        enabled: true,
        limit:
          catalog.defaultLimit === null || catalog.defaultLimit === undefined
            ? null
            : Number(catalog.defaultLimit),
        source: 'default',
      };
    }
    return { enabled: true, limit: null, source: 'default' };
  }

  return deny();
}

export function resolveOrganizationEntitlements(
  input: EntitlementResolutionInput
): OrganizationEntitlements {
  const result: OrganizationEntitlements = {};
  for (const feature of input.features) {
    if (!feature.isActive) continue;
    result[feature.key] = resolveFeatureEntitlement(feature.key, input);
  }
  return result;
}

export function isSubscriptionPeriodOpen(params: {
  status: SubscriptionStatus | null | undefined;
  trialEndsAt?: string | null;
  endsAt?: string | null;
  now?: Date;
}): boolean {
  const status = params.status;
  if (status !== 'trialing' && status !== 'active' && status !== 'past_due') {
    return false;
  }
  const now = (params.now ?? new Date()).getTime();
  if (status === 'trialing') {
    if (!params.trialEndsAt) return true;
    const ends = new Date(params.trialEndsAt).getTime();
    return Number.isFinite(ends) && ends > now;
  }
  if (!params.endsAt) return true;
  const ends = new Date(params.endsAt).getTime();
  return Number.isFinite(ends) && ends > now;
}

export function canUseResolvedFeature(
  entitlements: OrganizationEntitlements,
  featureKey: FeatureKey | string
): boolean {
  const row = entitlements[featureKey];
  return Boolean(row?.enabled);
}

/**
 * Limit convention:
 * - null = unlimited
 * - 0 = unavailable
 * - positive = max allowed
 * Missing / disabled → 0
 */
export function getResolvedFeatureLimit(
  entitlements: OrganizationEntitlements,
  featureKey: FeatureKey | string
): number | null {
  const row = entitlements[featureKey];
  if (!row || !row.enabled) return 0;
  return row.limit;
}
