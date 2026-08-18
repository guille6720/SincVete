import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  COMMERCIAL_PLAN_KEYS,
  ONBOARDING_PLAN_KEY,
  ONBOARDING_TRIAL_DAYS,
  METERED_FEATURE_KEYS,
  PUBLIC_PRICING_PLAN_KEYS,
  SUPERADMIN_ASSIGNABLE_PLAN_KEYS,
  assertNotLegacyAutoAssign,
  canSuperadminAssignPlan,
  isAutoAssignableOnboardingPlan,
  isLegacyPlanKey,
  isMeteredFeatureKey,
  isPublicPricingPlanKey,
  parseSuperadminEmails,
  validateUsageIncrementAmount,
  bytesToStorageMb,
  clinicalAiKindFeature,
  wouldExceedLimit,
  canUseResolvedFeature,
  getResolvedFeatureLimit,
  resolveFeatureEntitlement,
  resolveOrganizationEntitlements,
  getEntitledClinicHrefs,
  isClinicPathEntitled,
  utcMonthPeriod,
  isSubscriptionPeriodOpen,
  type EntitlementResolutionInput,
  type FeatureCatalogRow,
} from '../index';

const catalog: FeatureCatalogRow[] = [
  {
    key: FEATURES.AI,
    featureType: 'boolean',
    defaultEnabled: false,
    defaultLimit: null,
    isActive: true,
  },
  {
    key: FEATURES.INVENTORY,
    featureType: 'boolean',
    defaultEnabled: false,
    defaultLimit: null,
    isActive: true,
  },
  {
    key: FEATURES.AI_MONTHLY_REQUESTS,
    featureType: 'limit',
    defaultEnabled: true,
    defaultLimit: 0,
    isActive: true,
  },
  {
    key: FEATURES.USERS_MAX,
    featureType: 'limit',
    defaultEnabled: true,
    defaultLimit: 0,
    isActive: true,
  },
];

function baseInput(partial: Partial<EntitlementResolutionInput> = {}): EntitlementResolutionInput {
  return {
    features: catalog,
    planFeatures: [],
    overrides: [],
    hasActiveSubscription: true,
    ...partial,
  };
}

describe('resolveFeatureEntitlement — plan access', () => {
  it('enabled plan feature → true', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.AI, enabled: true, limitValue: null }],
      })
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe('plan');
  });

  it('disabled plan feature → false', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.AI, enabled: false, limitValue: null }],
      })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('plan');
  });
});

describe('resolveFeatureEntitlement — overrides', () => {
  it('plan false + override true → true', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.AI, enabled: false, limitValue: null }],
        overrides: [
          {
            featureKey: FEATURES.AI,
            enabled: true,
            limitValue: null,
            startsAt: null,
            endsAt: null,
          },
        ],
      })
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe('override');
  });

  it('plan true + override false → false', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.AI, enabled: true, limitValue: null }],
        overrides: [
          {
            featureKey: FEATURES.AI,
            enabled: false,
            limitValue: null,
            startsAt: null,
            endsAt: null,
          },
        ],
      })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('override');
  });
});

describe('resolveFeatureEntitlement — limits', () => {
  it('plan 100 → 100', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI_MONTHLY_REQUESTS,
      baseInput({
        planFeatures: [
          { featureKey: FEATURES.AI_MONTHLY_REQUESTS, enabled: true, limitValue: 100 },
        ],
      })
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.limit).toBe(100);
  });

  it('override 500 → 500', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.AI_MONTHLY_REQUESTS,
      baseInput({
        planFeatures: [
          { featureKey: FEATURES.AI_MONTHLY_REQUESTS, enabled: true, limitValue: 100 },
        ],
        overrides: [
          {
            featureKey: FEATURES.AI_MONTHLY_REQUESTS,
            enabled: true,
            limitValue: 500,
            startsAt: null,
            endsAt: null,
          },
        ],
      })
    );
    expect(resolved.limit).toBe(500);
    expect(resolved.source).toBe('override');
  });

  it('unlimited → null', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.USERS_MAX,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.USERS_MAX, enabled: true, limitValue: null }],
      })
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.limit).toBeNull();
  });

  it('disabled → 0', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.USERS_MAX,
      baseInput({
        planFeatures: [{ featureKey: FEATURES.USERS_MAX, enabled: false, limitValue: 10 }],
      })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.limit).toBe(0);
    expect(getResolvedFeatureLimit({ [FEATURES.USERS_MAX]: resolved }, FEATURES.USERS_MAX)).toBe(0);
  });
});

describe('resolveFeatureEntitlement — temporary overrides', () => {
  const now = new Date('2026-08-17T12:00:00.000Z');

  it('active window → applied', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.WHATSAPP,
      baseInput({
        now,
        features: [
          ...catalog,
          {
            key: FEATURES.WHATSAPP,
            featureType: 'boolean',
            defaultEnabled: false,
            defaultLimit: null,
            isActive: true,
          },
        ],
        planFeatures: [{ featureKey: FEATURES.WHATSAPP, enabled: false, limitValue: null }],
        overrides: [
          {
            featureKey: FEATURES.WHATSAPP,
            enabled: true,
            limitValue: null,
            startsAt: '2026-08-01T00:00:00.000Z',
            endsAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      })
    );
    expect(resolved.enabled).toBe(true);
    expect(resolved.source).toBe('override');
  });

  it('expired → ignored (falls back to plan)', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.WHATSAPP,
      baseInput({
        now,
        features: [
          ...catalog,
          {
            key: FEATURES.WHATSAPP,
            featureType: 'boolean',
            defaultEnabled: false,
            defaultLimit: null,
            isActive: true,
          },
        ],
        planFeatures: [{ featureKey: FEATURES.WHATSAPP, enabled: false, limitValue: null }],
        overrides: [
          {
            featureKey: FEATURES.WHATSAPP,
            enabled: true,
            limitValue: null,
            startsAt: '2026-07-01T00:00:00.000Z',
            endsAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('plan');
  });

  it('future → ignored until starts_at', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.WHATSAPP,
      baseInput({
        now,
        features: [
          ...catalog,
          {
            key: FEATURES.WHATSAPP,
            featureType: 'boolean',
            defaultEnabled: false,
            defaultLimit: null,
            isActive: true,
          },
        ],
        planFeatures: [{ featureKey: FEATURES.WHATSAPP, enabled: false, limitValue: null }],
        overrides: [
          {
            featureKey: FEATURES.WHATSAPP,
            enabled: true,
            limitValue: null,
            startsAt: '2026-09-01T00:00:00.000Z',
            endsAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('plan');
  });
});

describe('resolveFeatureEntitlement — unknown / deny', () => {
  it('unknown feature → DENY', () => {
    const resolved = resolveFeatureEntitlement('totally.unknown', baseInput());
    expect(resolved).toEqual({ enabled: false, limit: 0, source: 'deny' });
  });

  it('no subscription and no default → DENY', () => {
    const resolved = resolveFeatureEntitlement(
      FEATURES.INVENTORY,
      baseInput({ hasActiveSubscription: false, planFeatures: [] })
    );
    expect(resolved.enabled).toBe(false);
    expect(resolved.source).toBe('deny');
  });
});

describe('resolveOrganizationEntitlements helpers', () => {
  it('builds map and canUse helpers', () => {
    const map = resolveOrganizationEntitlements(
      baseInput({
        planFeatures: [
          { featureKey: FEATURES.AI, enabled: true, limitValue: null },
          { featureKey: FEATURES.INVENTORY, enabled: false, limitValue: null },
        ],
      })
    );
    expect(canUseResolvedFeature(map, FEATURES.AI)).toBe(true);
    expect(canUseResolvedFeature(map, FEATURES.INVENTORY)).toBe(false);
  });
});

describe('onboarding / legacy safeguards', () => {
  it('legacy is never auto-assignable', () => {
    expect(isLegacyPlanKey(COMMERCIAL_PLAN_KEYS.LEGACY)).toBe(true);
    expect(isAutoAssignableOnboardingPlan(COMMERCIAL_PLAN_KEYS.LEGACY)).toBe(false);
    expect(() => assertNotLegacyAutoAssign(COMMERCIAL_PLAN_KEYS.LEGACY)).toThrow(/migration-only/);
  });

  it('new organizations use trial onboarding plan, not legacy', () => {
    expect(ONBOARDING_PLAN_KEY).toBe(COMMERCIAL_PLAN_KEYS.TRIAL);
    expect(ONBOARDING_PLAN_KEY).not.toBe(COMMERCIAL_PLAN_KEYS.LEGACY);
    expect(isAutoAssignableOnboardingPlan(COMMERCIAL_PLAN_KEYS.TRIAL)).toBe(true);
    expect(isAutoAssignableOnboardingPlan(COMMERCIAL_PLAN_KEYS.BASIC)).toBe(false);
  });

  it('trial duration remains unset until product configures it', () => {
    expect(ONBOARDING_TRIAL_DAYS).toBeNull();
  });

  it('legacy and trial are excluded from public pricing selectors', () => {
    expect(PUBLIC_PRICING_PLAN_KEYS).not.toContain(COMMERCIAL_PLAN_KEYS.LEGACY);
    expect(PUBLIC_PRICING_PLAN_KEYS).not.toContain(COMMERCIAL_PLAN_KEYS.TRIAL);
    expect(isPublicPricingPlanKey(COMMERCIAL_PLAN_KEYS.LEGACY)).toBe(false);
    expect(isPublicPricingPlanKey(COMMERCIAL_PLAN_KEYS.TRIAL)).toBe(false);
    expect(isPublicPricingPlanKey(COMMERCIAL_PLAN_KEYS.BASIC)).toBe(true);
  });

  it('superadmin cannot assign legacy unless explicitly allowed', () => {
    expect(canSuperadminAssignPlan(COMMERCIAL_PLAN_KEYS.BASIC)).toBe(true);
    expect(canSuperadminAssignPlan(COMMERCIAL_PLAN_KEYS.TRIAL)).toBe(true);
    expect(canSuperadminAssignPlan(COMMERCIAL_PLAN_KEYS.LEGACY)).toBe(false);
    expect(canSuperadminAssignPlan(COMMERCIAL_PLAN_KEYS.LEGACY, true)).toBe(true);
    expect(SUPERADMIN_ASSIGNABLE_PLAN_KEYS).not.toContain(COMMERCIAL_PLAN_KEYS.LEGACY);
  });

  it('parses SUPERADMIN_EMAILS allowlist', () => {
    expect(parseSuperadminEmails('a@x.com, B@X.com; c@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
    expect(parseSuperadminEmails('')).toEqual([]);
    expect(parseSuperadminEmails(undefined)).toEqual([]);
  });

  it('existing organization on legacy keeps currently available modules', () => {
    const map = resolveOrganizationEntitlements(
      baseInput({
        planFeatures: catalog.map((f) => ({
          featureKey: f.key,
          enabled: true,
          limitValue: null,
        })),
      })
    );
    expect(canUseResolvedFeature(map, FEATURES.AI)).toBe(true);
    expect(canUseResolvedFeature(map, FEATURES.INVENTORY)).toBe(true);
    expect(getResolvedFeatureLimit(map, FEATURES.USERS_MAX)).toBeNull();
  });

  it('new organization on trial/basic does not inherit unlimited legacy entitlements', () => {
    const trialLike: EntitlementResolutionInput = baseInput({
      planFeatures: [
        { featureKey: FEATURES.INVENTORY, enabled: false, limitValue: null },
        { featureKey: FEATURES.AI, enabled: false, limitValue: null },
        { featureKey: FEATURES.USERS_MAX, enabled: true, limitValue: 3 },
      ],
    });
    expect(resolveFeatureEntitlement(FEATURES.AI, trialLike).enabled).toBe(false);
    expect(resolveFeatureEntitlement(FEATURES.INVENTORY, trialLike).enabled).toBe(false);
    expect(getResolvedFeatureLimit(
      { [FEATURES.USERS_MAX]: resolveFeatureEntitlement(FEATURES.USERS_MAX, trialLike) },
      FEATURES.USERS_MAX
    )).toBe(3);
  });
});

describe('usage increment validation helpers', () => {
  it('accepts positive integer amounts only', () => {
    expect(validateUsageIncrementAmount(1)).toBe(true);
    expect(validateUsageIncrementAmount(10)).toBe(true);
    expect(validateUsageIncrementAmount(0)).toBe(false);
    expect(validateUsageIncrementAmount(-1)).toBe(false);
    expect(validateUsageIncrementAmount(1.5)).toBe(false);
    expect(validateUsageIncrementAmount(null)).toBe(false);
    expect(validateUsageIncrementAmount(undefined)).toBe(false);
  });

  it('documents metered feature keys', () => {
    expect(METERED_FEATURE_KEYS).toContain(FEATURES.AI_MONTHLY_REQUESTS);
    expect(METERED_FEATURE_KEYS).toContain(FEATURES.WHATSAPP_MONTHLY_MESSAGES);
    expect(METERED_FEATURE_KEYS).not.toContain(FEATURES.AI);
    expect(isMeteredFeatureKey(FEATURES.STORAGE_MAX_MB)).toBe(true);
    expect(isMeteredFeatureKey(FEATURES.AI)).toBe(false);
  });

  it('counts storage usage in whole megabytes', () => {
    expect(bytesToStorageMb(0)).toBe(0);
    expect(bytesToStorageMb(-1)).toBe(0);
    expect(bytesToStorageMb(1)).toBe(1);
    expect(bytesToStorageMb(1024 * 1024)).toBe(1);
    expect(bytesToStorageMb(1024 * 1024 + 1)).toBe(2);
  });

  it('maps clinical AI kinds to feature keys', () => {
    expect(clinicalAiKindFeature('patient_summary')).toBe(FEATURES.AI_PATIENT_SUMMARY);
    expect(clinicalAiKindFeature('soap_assist')).toBe(FEATURES.AI_SOAP_ASSISTANT);
    expect(clinicalAiKindFeature('owner_instructions')).toBe(FEATURES.AI_OWNER_INSTRUCTIONS);
  });

  it('wouldExceedLimit follows null/0/positive convention', () => {
    expect(wouldExceedLimit(100, 1, null)).toBe(false);
    expect(wouldExceedLimit(0, 1, 0)).toBe(true);
    expect(wouldExceedLimit(2, 1, 3)).toBe(false);
    expect(wouldExceedLimit(3, 1, 3)).toBe(true);
  });
});

describe('clinic nav entitlements', () => {
  it('hides unpurchased modules and keeps settings visible', () => {
    const entitlements = resolveOrganizationEntitlements(
      baseInput({
        features: [
          ...catalog,
          {
            key: FEATURES.WHATSAPP,
            featureType: 'boolean',
            defaultEnabled: false,
            defaultLimit: null,
            isActive: true,
          },
          {
            key: FEATURES.DASHBOARD,
            featureType: 'boolean',
            defaultEnabled: true,
            defaultLimit: null,
            isActive: true,
          },
        ],
        planFeatures: [
          { featureKey: FEATURES.DASHBOARD, enabled: true, limitValue: null },
          { featureKey: FEATURES.WHATSAPP, enabled: false, limitValue: 0 },
        ],
      })
    );

    const hrefs = getEntitledClinicHrefs(entitlements);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/configuracion');
    expect(hrefs).not.toContain('/whatsapp');
    expect(isClinicPathEntitled('/whatsapp', hrefs)).toBe(false);
    expect(isClinicPathEntitled('/whatsapp/nuevo', hrefs)).toBe(false);
    expect(isClinicPathEntitled('/configuracion', hrefs)).toBe(true);
    expect(isClinicPathEntitled('/pacientes/nuevo', hrefs)).toBe(false);
    expect(isClinicPathEntitled('/ruta-desconocida', hrefs)).toBe(true);
    expect(isClinicPathEntitled('/whatsapp', null)).toBe(true);
  });

  it('utcMonthPeriod uses UTC month bounds', () => {
    const period = utcMonthPeriod(new Date('2026-08-18T10:00:00.000Z'));
    expect(period.start).toBe('2026-08-01');
    expect(period.end).toBe('2026-08-31');
  });
});

describe('subscription period', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('keeps open-ended trial and legacy active without end dates', () => {
    expect(
      isSubscriptionPeriodOpen({ status: 'trialing', trialEndsAt: null, endsAt: null, now })
    ).toBe(true);
    expect(
      isSubscriptionPeriodOpen({ status: 'active', trialEndsAt: null, endsAt: null, now })
    ).toBe(true);
  });

  it('closes trial and paid periods after their end timestamps', () => {
    expect(
      isSubscriptionPeriodOpen({
        status: 'trialing',
        trialEndsAt: '2026-08-01T00:00:00.000Z',
        now,
      })
    ).toBe(false);
    expect(
      isSubscriptionPeriodOpen({
        status: 'active',
        endsAt: '2026-08-17T00:00:00.000Z',
        now,
      })
    ).toBe(false);
    expect(
      isSubscriptionPeriodOpen({
        status: 'past_due',
        endsAt: '2026-08-19T00:00:00.000Z',
        now,
      })
    ).toBe(true);
    expect(isSubscriptionPeriodOpen({ status: 'expired', now })).toBe(false);
  });
});
