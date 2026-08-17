import { cache } from 'react';
import {
  FEATURES,
  canUseResolvedFeature,
  getResolvedFeatureLimit,
  resolveOrganizationEntitlements,
  type FeatureCatalogRow,
  type FeatureKey,
  type FeatureOverrideRow,
  type OrganizationEntitlements,
  type PlanFeatureRow,
  type ResolvedEntitlement,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';

export class FeatureNotAvailableError extends Error {
  constructor(featureKey: string, message = 'Esta función no está incluida en tu plan') {
    super(`${message} (${featureKey})`);
    this.name = 'FeatureNotAvailableError';
  }
}

/** Untyped access until Database types are regenerated for Phase 1 tables. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function entitlementDb(): Promise<any> {
  return createServerClient();
}

type NestedFeature = { key: string } | { key: string }[] | null;

function featureKeyFromJoin(features: NestedFeature): string | null {
  if (!features) return null;
  if (Array.isArray(features)) return features[0]?.key ?? null;
  return features.key ?? null;
}

/**
 * Load raw entitlement inputs for an organization (batched, no N+1).
 * Request-scoped via React.cache — never reuse across tenants.
 */
export const loadOrganizationEntitlementInput = cache(async (organizationId: string) => {
  const supabase = await entitlementDb();

  const [featuresRes, subscriptionRes, overridesRes] = await Promise.all([
    supabase
      .from('features')
      .select('key, feature_type, default_enabled, default_limit, is_active'),
    supabase
      .from('organization_subscriptions')
      .select('id, plan_id, status, cancelled_at')
      .eq('organization_id', organizationId)
      .in('status', ['trialing', 'active'])
      .is('cancelled_at', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('organization_feature_overrides')
      .select('enabled, limit_value, starts_at, ends_at, features!inner(key)')
      .eq('organization_id', organizationId),
  ]);

  if (featuresRes.error) {
    throw new Error(`No se pudieron cargar features: ${featuresRes.error.message}`);
  }
  if (subscriptionRes.error) {
    throw new Error(`No se pudo cargar la suscripción: ${subscriptionRes.error.message}`);
  }
  if (overridesRes.error) {
    throw new Error(`No se pudieron cargar overrides: ${overridesRes.error.message}`);
  }

  const features: FeatureCatalogRow[] = (featuresRes.data ?? []).map(
    (f: {
      key: string;
      feature_type: 'boolean' | 'limit';
      default_enabled: boolean;
      default_limit: number | string | null;
      is_active: boolean;
    }) => ({
      key: f.key,
      featureType: f.feature_type,
      defaultEnabled: f.default_enabled,
      defaultLimit: f.default_limit === null ? null : Number(f.default_limit),
      isActive: f.is_active,
    })
  );

  const activeSub = subscriptionRes.data as { id: string; plan_id: string } | null;
  let planFeatures: PlanFeatureRow[] = [];

  if (activeSub?.plan_id) {
    const { data: pfData, error: pfError } = await supabase
      .from('plan_features')
      .select('enabled, limit_value, features!inner(key)')
      .eq('plan_id', activeSub.plan_id);

    if (pfError) {
      throw new Error(`No se pudieron cargar plan_features: ${pfError.message}`);
    }

    planFeatures = (pfData ?? [])
      .map(
        (row: {
          enabled: boolean;
          limit_value: number | string | null;
          features: NestedFeature;
        }) => {
          const key = featureKeyFromJoin(row.features);
          if (!key) return null;
          return {
            featureKey: key,
            enabled: row.enabled,
            limitValue: row.limit_value === null ? null : Number(row.limit_value),
          } satisfies PlanFeatureRow;
        }
      )
      .filter(Boolean) as PlanFeatureRow[];
  }

  const overrides: FeatureOverrideRow[] = (overridesRes.data ?? [])
    .map(
      (row: {
        enabled: boolean | null;
        limit_value: number | string | null;
        starts_at: string | null;
        ends_at: string | null;
        features: NestedFeature;
      }) => {
        const key = featureKeyFromJoin(row.features);
        if (!key) return null;
        return {
          featureKey: key,
          enabled: row.enabled,
          limitValue: row.limit_value === null ? null : Number(row.limit_value),
          startsAt: row.starts_at,
          endsAt: row.ends_at,
        } satisfies FeatureOverrideRow;
      }
    )
    .filter(Boolean) as FeatureOverrideRow[];

  return {
    features,
    planFeatures,
    overrides,
    hasActiveSubscription: Boolean(activeSub),
    planId: activeSub?.plan_id ?? null,
  };
});

export const getOrganizationEntitlements = cache(
  async (organizationId: string): Promise<OrganizationEntitlements> => {
    const input = await loadOrganizationEntitlementInput(organizationId);
    return resolveOrganizationEntitlements(input);
  }
);

export async function canUseFeature(params: {
  organizationId: string;
  featureKey: FeatureKey | string;
}): Promise<boolean> {
  const entitlements = await getOrganizationEntitlements(params.organizationId);
  return canUseResolvedFeature(entitlements, params.featureKey);
}

/**
 * Limit convention:
 * - null = unlimited
 * - 0 = unavailable
 * - positive = maximum allowed
 */
export async function getFeatureLimit(params: {
  organizationId: string;
  featureKey: FeatureKey | string;
}): Promise<number | null> {
  const entitlements = await getOrganizationEntitlements(params.organizationId);
  return getResolvedFeatureLimit(entitlements, params.featureKey);
}

export async function getFeatureEntitlement(params: {
  organizationId: string;
  featureKey: FeatureKey | string;
}): Promise<ResolvedEntitlement> {
  const entitlements = await getOrganizationEntitlements(params.organizationId);
  return (
    entitlements[params.featureKey] ?? {
      enabled: false,
      limit: 0,
      source: 'deny',
    }
  );
}

export async function requireFeature(
  organizationId: string,
  featureKey: FeatureKey
): Promise<void> {
  const allowed = await canUseFeature({ organizationId, featureKey });
  if (!allowed) {
    throw new FeatureNotAvailableError(featureKey);
  }
}

export { FEATURES };
