import {
  FEATURES,
  PLAN_UPGRADE_LADDER,
  SEAT_USAGE_LABELS,
  METERED_USAGE_LABELS,
  computePlanRecommendation,
  comparePlanFeatures,
  getResolvedFeatureLimit,
  type PlanRecommendation,
  type PlanRecommendationInput,
  type PaidPlanKey,
  type FeatureGrantSnapshot,
  type ModuleActivitySnapshot,
  type UsageMeterSnapshot,
  type RecommendationStatus,
  type CommercialPlanKey,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { requireSuperadmin } from '@/lib/permissions';
import { getOrganizationEntitlements, loadOrganizationEntitlementInput } from '@/lib/entitlements';

export type PlanCatalogMatrix = {
  plans: Array<{
    key: string;
    name: string;
    isInternal: boolean;
    isPublic: boolean;
    features: Array<{
      featureKey: string;
      featureName: string;
      enabled: boolean;
      limitValue: number | null;
    }>;
  }>;
};

type RecommendationInputRow = {
  id: string;
  name: string;
  slug: string;
  plan_key: string | null;
  plan_name: string | null;
  status: PlanRecommendationInput['subscriptionStatus'];
  trial_ends_at: string | null;
  starts_at: string | null;
  created_at: string;
  owner_name: string | null;
  users_used: number;
  branches_used: number;
  professionals_used: number;
  patients_used: number;
  ai_used: number;
  whatsapp_used: number;
  storage_used: number;
  has_hospitalization: boolean;
  has_surgery: boolean;
  has_laboratory: boolean;
  has_inventory: boolean;
  has_pharmacy: boolean;
  has_billing: boolean;
  has_cash: boolean;
  has_portal: boolean;
  has_reports: boolean;
  has_ai: boolean;
  has_whatsapp: boolean;
  has_images: boolean;
  has_advanced_reports: boolean;
  access_attempt_features: string[] | null;
  rec_status: string | null;
  rec_recommended_plan_key: string | null;
  rec_fingerprint: string | null;
  rec_dismissed_at: string | null;
  rec_max_usage_ratio_at_dismiss: number | null;
  total_count: number;
};

let catalogCache: { at: number; value: PlanCatalogMatrix } | null = null;

export async function loadPlanCatalogMatrix(): Promise<PlanCatalogMatrix> {
  await requireSuperadmin();
  if (catalogCache && Date.now() - catalogCache.at < 60_000) {
    return catalogCache.value;
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_plan_catalog_matrix');
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as {
    plans?: Array<{
      key: string;
      name: string;
      is_internal?: boolean;
      is_public?: boolean;
      features?: Array<{
        feature_key: string;
        feature_name: string;
        enabled: boolean;
        limit_value: number | null;
      }>;
    }>;
  };
  const value: PlanCatalogMatrix = {
    plans: (raw.plans ?? []).map((plan) => ({
      key: plan.key,
      name: plan.name,
      isInternal: Boolean(plan.is_internal),
      isPublic: Boolean(plan.is_public),
      features: (plan.features ?? []).map((f) => ({
        featureKey: f.feature_key,
        featureName: f.feature_name,
        enabled: Boolean(f.enabled),
        limitValue: f.limit_value === null || f.limit_value === undefined ? null : Number(f.limit_value),
      })),
    })),
  };
  catalogCache = { at: Date.now(), value };
  return value;
}

function matrixToEngineMaps(matrix: PlanCatalogMatrix): {
  planIncludesFeature: PlanRecommendationInput['planIncludesFeature'];
  planLimits: PlanRecommendationInput['planLimits'];
  featureNames: Record<string, string>;
} {
  const planIncludesFeature: PlanRecommendationInput['planIncludesFeature'] = {};
  const planLimits: PlanRecommendationInput['planLimits'] = {};
  const featureNames: Record<string, string> = {};

  for (const plan of matrix.plans) {
    if (!(PLAN_UPGRADE_LADDER as readonly string[]).includes(plan.key)) continue;
    const key = plan.key as PaidPlanKey;
    planIncludesFeature[key] = plan.features.filter((f) => f.enabled).map((f) => f.featureKey);
    const limits: Record<string, number | null> = {};
    for (const f of plan.features) {
      featureNames[f.featureKey] = f.featureName;
      if (f.limitValue !== null || f.enabled) {
        limits[f.featureKey] = f.enabled ? f.limitValue : 0;
      }
    }
    planLimits[key] = limits;
  }
  return { planIncludesFeature, planLimits, featureNames };
}

function activityFromRow(row: RecommendationInputRow): ModuleActivitySnapshot[] {
  return [
    { featureKey: FEATURES.HOSPITALIZATION, active: row.has_hospitalization },
    { featureKey: FEATURES.SURGERY, active: row.has_surgery },
    { featureKey: FEATURES.LABORATORY, active: row.has_laboratory },
    { featureKey: FEATURES.INVENTORY, active: row.has_inventory },
    { featureKey: FEATURES.PHARMACY, active: row.has_pharmacy },
    { featureKey: FEATURES.BILLING, active: row.has_billing },
    { featureKey: FEATURES.CASH_REGISTER, active: row.has_cash },
    { featureKey: FEATURES.OWNER_PORTAL, active: row.has_portal },
    { featureKey: FEATURES.BASIC_REPORTS, active: row.has_reports },
    { featureKey: FEATURES.AI, active: row.has_ai },
    { featureKey: FEATURES.WHATSAPP, active: row.has_whatsapp },
    { featureKey: FEATURES.CLINICAL_IMAGES, active: row.has_images },
    { featureKey: FEATURES.ADVANCED_REPORTS, active: row.has_advanced_reports },
  ];
}

function seatsFromRow(row: RecommendationInputRow, limits: Record<string, number | null>): UsageMeterSnapshot[] {
  const mk = (featureKey: string, used: number): UsageMeterSnapshot => ({
    featureKey,
    label: SEAT_USAGE_LABELS[featureKey] ?? featureKey,
    used: Number(used) || 0,
    limit: limits[featureKey] ?? null,
  });
  return [
    mk(FEATURES.USERS_MAX, row.users_used),
    mk(FEATURES.BRANCHES_MAX, row.branches_used),
    mk(FEATURES.PROFESSIONALS_MAX, row.professionals_used),
    mk(FEATURES.PATIENTS_MAX, row.patients_used),
  ];
}

function metersFromRow(row: RecommendationInputRow, limits: Record<string, number | null>): UsageMeterSnapshot[] {
  const mk = (featureKey: string, used: number): UsageMeterSnapshot => ({
    featureKey,
    label: METERED_USAGE_LABELS[featureKey] ?? featureKey,
    used: Number(used) || 0,
    limit: limits[featureKey] ?? null,
  });
  return [
    mk(FEATURES.AI_MONTHLY_REQUESTS, row.ai_used),
    mk(FEATURES.WHATSAPP_MONTHLY_MESSAGES, row.whatsapp_used),
    mk(FEATURES.STORAGE_MAX_MB, row.storage_used),
  ];
}

/** Approximate grants from plan matrix when per-org entitlements are not loaded (list path). */
function grantsFromPlanMatrix(
  planKey: string | null,
  matrix: PlanCatalogMatrix,
  activity: ModuleActivitySnapshot[],
  accessAttempts: string[]
): FeatureGrantSnapshot[] {
  const plan = matrix.plans.find((p) => p.key === planKey);
  const grants: FeatureGrantSnapshot[] = [];
  const seen = new Set<string>();
  for (const f of plan?.features ?? []) {
    seen.add(f.featureKey);
    grants.push({
      featureKey: f.featureKey,
      enabled: Boolean(f.enabled),
      source: f.enabled ? 'plan' : 'deny',
    });
  }
  // Access attempts / activity on features not in plan → not granted
  for (const item of [...activity, ...accessAttempts.map((k) => ({ featureKey: k, active: true }))]) {
    if (seen.has(item.featureKey)) continue;
    grants.push({ featureKey: item.featureKey, enabled: false, source: 'deny' });
  }
  return grants;
}

export type SuperadminOrgRecommendationRow = {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  planKey: string | null;
  planName: string | null;
  status: PlanRecommendationInput['subscriptionStatus'];
  trialEndsAt: string | null;
  startsAt: string | null;
  createdAt: string;
  usersUsed: number;
  branchesUsed: number;
  patientsUsed: number;
  recommendation: PlanRecommendation;
};

export async function listSuperadminOrganizationsWithRecommendations(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  planKey?: string;
  status?: string;
  recommendedPlan?: string;
  upgradeFilter?: string;
  sort?: string;
}): Promise<{
  rows: SuperadminOrgRecommendationRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: RecommendationDashboardSummary;
}> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const matrix = await loadPlanCatalogMatrix();
  const maps = matrixToEngineMaps(matrix);

  const { data, error } = await supabase.rpc('superadmin_list_orgs_recommendation_inputs', {
    p_search: params.search?.trim() || null,
    p_page: page,
    p_page_size: pageSize,
    p_plan_key: params.planKey?.trim() || null,
    p_status: params.status?.trim() || null,
    p_recommended_plan: params.recommendedPlan?.trim() || null,
    p_upgrade_filter: params.upgradeFilter?.trim() || null,
    p_sort: params.sort?.trim() || null,
    p_organization_id: null,
  });
  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as RecommendationInputRow[];
  const total = Number(rawRows[0]?.total_count ?? 0);

  // Load entitlements for the page only (batched, not N+1 across all clinics).
  const entitlementsByOrg = new Map<string, Awaited<ReturnType<typeof getOrganizationEntitlements>>>();
  await Promise.all(
    rawRows.map(async (row) => {
      try {
        const entitlements = await getOrganizationEntitlements(row.id);
        entitlementsByOrg.set(row.id, entitlements);
      } catch {
        // Schema may be incomplete; fall back to plan matrix grants.
      }
    })
  );

  const rows: SuperadminOrgRecommendationRow[] = rawRows.map((row) => {
    const entitlements = entitlementsByOrg.get(row.id);
    const activity = activityFromRow(row);
    const accessAttempts = row.access_attempt_features ?? [];
    const limitKeys = [
      FEATURES.USERS_MAX,
      FEATURES.BRANCHES_MAX,
      FEATURES.PROFESSIONALS_MAX,
      FEATURES.PATIENTS_MAX,
      FEATURES.AI_MONTHLY_REQUESTS,
      FEATURES.WHATSAPP_MONTHLY_MESSAGES,
      FEATURES.STORAGE_MAX_MB,
    ];
    const limits: Record<string, number | null> = {};
    for (const key of limitKeys) {
      limits[key] = entitlements
        ? getResolvedFeatureLimit(entitlements, key)
        : maps.planLimits[row.plan_key as PaidPlanKey]?.[key] ?? null;
    }

    const grants: FeatureGrantSnapshot[] = entitlements
      ? Object.entries(entitlements).map(([featureKey, resolved]) => ({
          featureKey,
          enabled: resolved.enabled,
          source: resolved.source,
        }))
      : grantsFromPlanMatrix(row.plan_key, matrix, activity, accessAttempts);

    const recommendation = computePlanRecommendation({
      organizationId: row.id,
      currentPlanKey: row.plan_key,
      subscriptionStatus: row.status,
      seats: seatsFromRow(row, limits),
      meters: metersFromRow(row, limits),
      grants,
      activity,
      accessAttempts,
      planIncludesFeature: maps.planIncludesFeature,
      planLimits: maps.planLimits,
      persisted: row.rec_status
        ? {
            status: row.rec_status as RecommendationStatus,
            recommendedPlanKey: row.rec_recommended_plan_key,
            fingerprint: row.rec_fingerprint,
            dismissedAt: row.rec_dismissed_at,
            maxUsageRatioAtDismiss:
              row.rec_max_usage_ratio_at_dismiss === null
                ? null
                : Number(row.rec_max_usage_ratio_at_dismiss),
          }
        : null,
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerName: row.owner_name,
      planKey: row.plan_key,
      planName: row.plan_name,
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      startsAt: row.starts_at,
      createdAt: row.created_at,
      usersUsed: Number(row.users_used) || 0,
      branchesUsed: Number(row.branches_used) || 0,
      patientsUsed: Number(row.patients_used) || 0,
      recommendation,
    };
  });

  // Persist active recommendations so clinic soft notices can appear (best-effort, page only).
  await Promise.all(
    rows
      .filter((row) => row.recommendation.shouldRecommendUpgrade && row.recommendation.status === 'recommended')
      .map(async (row) => {
        try {
          await persistPlanRecommendation(row.recommendation, 'recommended');
        } catch {
          // Persistence optional if phase 31/32 not applied yet.
        }
      })
  );

  const [pageSummary, globalSummary] = await Promise.all([
    Promise.resolve(buildRecommendationSummary(rows, total)),
    getGlobalRecommendationSummary().catch(() => null),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    summary: globalSummary ?? pageSummary,
  };
}

export type RecommendationDashboardSummary = {
  upgradeRecommended: number;
  basicToPro: number;
  proToPremium: number;
  premiumToEnterprise: number;
  nearLimit: number;
  atLimit: number;
  legacyReview: number;
  trialConversion: number;
  reviewed?: number;
  dismissed?: number;
  accepted?: number;
  clinicDismissedActive?: number;
};

export async function getGlobalRecommendationSummary(): Promise<RecommendationDashboardSummary> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_recommendation_summary');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  const num = (key: string) => Number(row[key] ?? 0) || 0;
  return {
    upgradeRecommended: num('upgrade_recommended'),
    basicToPro: num('basic_to_pro'),
    proToPremium: num('pro_to_premium'),
    premiumToEnterprise: num('premium_to_enterprise'),
    nearLimit: num('near_limit'),
    atLimit: num('at_limit'),
    legacyReview: num('legacy_rows'),
    trialConversion: num('trial_conversion'),
    reviewed: num('reviewed'),
    dismissed: num('dismissed'),
    accepted: num('accepted'),
    clinicDismissedActive: num('clinic_dismissed_active'),
  };
}

function buildRecommendationSummary(
  rows: SuperadminOrgRecommendationRow[],
  _total: number
): RecommendationDashboardSummary {
  const summary: RecommendationDashboardSummary = {
    upgradeRecommended: 0,
    basicToPro: 0,
    proToPremium: 0,
    premiumToEnterprise: 0,
    nearLimit: 0,
    atLimit: 0,
    legacyReview: 0,
    trialConversion: 0,
  };
  for (const row of rows) {
    const rec = row.recommendation;
    if (rec.shouldRecommendUpgrade) summary.upgradeRecommended += 1;
    if (rec.upgradeStatus === 'near_limit') summary.nearLimit += 1;
    if (rec.upgradeStatus === 'limit_reached') summary.atLimit += 1;
    if (rec.upgradeStatus === 'legacy_review') summary.legacyReview += 1;
    if (rec.upgradeStatus === 'trial_conversion') summary.trialConversion += 1;
    if (rec.shouldRecommendUpgrade && rec.recommendedPlan === 'pro' && rec.currentPlan === 'basic') {
      summary.basicToPro += 1;
    }
    if (rec.shouldRecommendUpgrade && rec.recommendedPlan === 'premium' && rec.currentPlan === 'pro') {
      summary.proToPremium += 1;
    }
    if (
      rec.shouldRecommendUpgrade &&
      rec.recommendedPlan === 'enterprise' &&
      rec.currentPlan === 'premium'
    ) {
      summary.premiumToEnterprise += 1;
    }
  }
  return summary;
}

export async function getPlanRecommendationForOrganization(
  organizationId: string
): Promise<{
  recommendation: PlanRecommendation;
  comparison: ReturnType<typeof comparePlanFeatures> | null;
  catalog: PlanCatalogMatrix;
}> {
  await requireSuperadmin();
  const matrix = await loadPlanCatalogMatrix();
  const maps = matrixToEngineMaps(matrix);
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('superadmin_list_orgs_recommendation_inputs', {
    p_search: null,
    p_page: 1,
    p_page_size: 1,
    p_plan_key: null,
    p_status: null,
    p_recommended_plan: null,
    p_upgrade_filter: null,
    p_sort: null,
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const rawRows = (data ?? []) as RecommendationInputRow[];
  let row = rawRows.find((r) => r.id === organizationId);

  if (!row) {
    // Org may be outside first page — fetch by scanning pages is avoided; build minimal input.
    const entitlements = await getOrganizationEntitlements(organizationId);
    const input = await loadOrganizationEntitlementInput(organizationId);
    const grants: FeatureGrantSnapshot[] = Object.entries(entitlements).map(([featureKey, resolved]) => ({
      featureKey,
      enabled: resolved.enabled,
      source: resolved.source,
    }));
    const recommendation = computePlanRecommendation({
      organizationId,
      currentPlanKey: input.planKey,
      subscriptionStatus: input.subscriptionStatus,
      seats: [],
      meters: [],
      grants,
      activity: [],
      accessAttempts: [],
      planIncludesFeature: maps.planIncludesFeature,
      planLimits: maps.planLimits,
    });
    return {
      recommendation,
      comparison: null,
      catalog: matrix,
    };
  }

  const entitlements = await getOrganizationEntitlements(organizationId).catch(() => null);
  const activity = activityFromRow(row);
  const accessAttempts = row.access_attempt_features ?? [];
  const limitKeys = [
    FEATURES.USERS_MAX,
    FEATURES.BRANCHES_MAX,
    FEATURES.PROFESSIONALS_MAX,
    FEATURES.PATIENTS_MAX,
    FEATURES.AI_MONTHLY_REQUESTS,
    FEATURES.WHATSAPP_MONTHLY_MESSAGES,
    FEATURES.STORAGE_MAX_MB,
  ];
  const limits: Record<string, number | null> = {};
  for (const key of limitKeys) {
    limits[key] = entitlements
      ? getResolvedFeatureLimit(entitlements, key)
      : maps.planLimits[row.plan_key as PaidPlanKey]?.[key] ?? null;
  }
  const grants: FeatureGrantSnapshot[] = entitlements
    ? Object.entries(entitlements).map(([featureKey, resolved]) => ({
        featureKey,
        enabled: resolved.enabled,
        source: resolved.source,
      }))
    : grantsFromPlanMatrix(row.plan_key, matrix, activity, accessAttempts);

  const recommendation = computePlanRecommendation({
    organizationId: row.id,
    currentPlanKey: row.plan_key,
    subscriptionStatus: row.status,
    seats: seatsFromRow(row, limits),
    meters: metersFromRow(row, limits),
    grants,
    activity,
    accessAttempts,
    planIncludesFeature: maps.planIncludesFeature,
    planLimits: maps.planLimits,
    persisted: row.rec_status
      ? {
          status: row.rec_status as RecommendationStatus,
          recommendedPlanKey: row.rec_recommended_plan_key,
          fingerprint: row.rec_fingerprint,
          dismissedAt: row.rec_dismissed_at,
          maxUsageRatioAtDismiss:
            row.rec_max_usage_ratio_at_dismiss === null
              ? null
              : Number(row.rec_max_usage_ratio_at_dismiss),
        }
      : null,
  });

  let comparison: ReturnType<typeof comparePlanFeatures> | null = null;
  if (recommendation.recommendedPlan && recommendation.currentPlan) {
    const current = matrix.plans.find((p) => p.key === recommendation.currentPlan);
    const target = matrix.plans.find((p) => p.key === recommendation.recommendedPlan);
    if (current && target) {
      comparison = comparePlanFeatures({
        currentPlanKey: current.key,
        targetPlanKey: target.key,
        featureNames: maps.featureNames,
        currentFeatures: current.features.map((f) => ({
          featureKey: f.featureKey,
          enabled: f.enabled,
          limitValue: f.limitValue,
        })),
        targetFeatures: target.features.map((f) => ({
          featureKey: f.featureKey,
          enabled: f.enabled,
          limitValue: f.limitValue,
        })),
      });
    }
  }

  return { recommendation, comparison, catalog: matrix };
}

export async function persistPlanRecommendation(
  recommendation: PlanRecommendation,
  status?: RecommendationStatus
): Promise<void> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const nextStatus = status ?? recommendation.status;
  const { error } = await supabase.rpc('superadmin_upsert_plan_recommendation', {
    p_organization_id: recommendation.organizationId,
    p_status: nextStatus,
    p_current_plan_key: recommendation.currentPlan,
    p_recommended_plan_key: recommendation.recommendedPlan,
    p_severity: recommendation.severity,
    p_score: recommendation.score,
    p_usage_level: recommendation.usageLevel,
    p_reasons: recommendation.reasons,
    p_fingerprint: recommendation.fingerprint,
    p_max_usage_ratio_at_dismiss:
      nextStatus === 'dismissed' ? recommendation.usageLevel : null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Soft clinic notice for org managers (Configuración → Plan).
 * Only shows Superadmin-persisted recommendations (phase 31/32).
 */
export type ClinicPlanRecommendationNotice = {
  currentPlan: string | null;
  recommendedPlan: PaidPlanKey;
  reasons: string[];
  severity: string;
  usageLevel: number;
  fingerprint: string | null;
};

export async function getClinicFacingPlanRecommendationHint(
  organizationId: string
): Promise<ClinicPlanRecommendationNotice | null> {
  void organizationId;
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('list_own_plan_recommendation_notice');
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }
    const row = data as Record<string, unknown>;
    const recommended = typeof row.recommended_plan_key === 'string' ? row.recommended_plan_key : null;
    if (!recommended || !(PLAN_UPGRADE_LADDER as readonly string[]).includes(recommended)) {
      return null;
    }
    const reasonsRaw = row.reasons;
    const reasons = Array.isArray(reasonsRaw) ? reasonsRaw.map((item) => String(item)) : [];
    return {
      currentPlan: typeof row.current_plan_key === 'string' ? row.current_plan_key : null,
      recommendedPlan: recommended as PaidPlanKey,
      reasons,
      severity: typeof row.severity === 'string' ? row.severity : 'info',
      usageLevel: Number(row.usage_level ?? 0) || 0,
      fingerprint: typeof row.fingerprint === 'string' ? row.fingerprint : null,
    };
  } catch {
    return null;
  }
}

export type PlanRecommendationHistoryEvent = {
  id: string;
  eventType: string;
  actorKind: string;
  actorUserId: string | null;
  currentPlanKey: string | null;
  recommendedPlanKey: string | null;
  severity: string | null;
  score: number | null;
  usageLevel: number | null;
  reasons: string[];
  fingerprint: string | null;
  note: string | null;
  createdAt: string;
};

export async function listPlanRecommendationHistory(
  organizationId: string,
  limit = 50
): Promise<PlanRecommendationHistoryEvent[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_plan_recommendation_events', {
    p_organization_id: organizationId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorKind: row.actor_kind,
    actorUserId: row.actor_user_id,
    currentPlanKey: row.current_plan_key,
    recommendedPlanKey: row.recommended_plan_key,
    severity: row.severity,
    score: row.score,
    usageLevel: row.usage_level === null ? null : Number(row.usage_level),
    reasons: Array.isArray(row.reasons) ? row.reasons.map((item) => String(item)) : [],
    fingerprint: row.fingerprint,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function dismissClinicPlanRecommendationNotice(): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('dismiss_own_plan_recommendation_notice');
  if (error) throw new Error(error.message);
}

export type { CommercialPlanKey };
