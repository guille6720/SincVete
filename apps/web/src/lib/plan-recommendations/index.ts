import {
  FEATURES,
  PLAN_UPGRADE_LADDER,
  PLAN_USAGE_THRESHOLDS,
  SEAT_USAGE_LABELS,
  METERED_USAGE_LABELS,
  computePlanRecommendation,
  comparePlanFeatures,
  formatRecommendationsCsv,
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
let thresholdsCache: { at: number; value: typeof PLAN_USAGE_THRESHOLDS } | null = null;

export type RecommendationSettings = {
  thresholdInfo: number;
  thresholdWarning: number;
  thresholdCritical: number;
  clinicSnoozeDays: number;
  updatedAt: string | null;
};

export async function loadRecommendationThresholds(): Promise<typeof PLAN_USAGE_THRESHOLDS> {
  if (thresholdsCache && Date.now() - thresholdsCache.at < 60_000) {
    return thresholdsCache.value;
  }
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('get_recommendation_thresholds');
    if (error || !data || typeof data !== 'object') {
      return PLAN_USAGE_THRESHOLDS;
    }
    const row = data as Record<string, unknown>;
    const info = Number(row.info);
    const warning = Number(row.warning);
    const critical = Number(row.critical);
    const value = {
      info: Number.isFinite(info) && info > 0 ? info : PLAN_USAGE_THRESHOLDS.info,
      warning: Number.isFinite(warning) && warning > 0 ? warning : PLAN_USAGE_THRESHOLDS.warning,
      critical: Number.isFinite(critical) && critical > 0 ? critical : PLAN_USAGE_THRESHOLDS.critical,
    } as typeof PLAN_USAGE_THRESHOLDS;
    thresholdsCache = { at: Date.now(), value };
    return value;
  } catch {
    return PLAN_USAGE_THRESHOLDS;
  }
}

export async function getRecommendationSettings(): Promise<RecommendationSettings> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_get_recommendation_settings');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    thresholdInfo: Number(row.threshold_info ?? PLAN_USAGE_THRESHOLDS.info),
    thresholdWarning: Number(row.threshold_warning ?? PLAN_USAGE_THRESHOLDS.warning),
    thresholdCritical: Number(row.threshold_critical ?? PLAN_USAGE_THRESHOLDS.critical),
    clinicSnoozeDays: Number(row.clinic_snooze_days ?? 14) || 14,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function setRecommendationSettings(input: {
  thresholdInfo: number;
  thresholdWarning: number;
  thresholdCritical: number;
  clinicSnoozeDays: number;
}): Promise<RecommendationSettings> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_set_recommendation_settings', {
    p_threshold_info: input.thresholdInfo,
    p_threshold_warning: input.thresholdWarning,
    p_threshold_critical: input.thresholdCritical,
    p_clinic_snooze_days: input.clinicSnoozeDays,
  });
  if (error) throw new Error(error.message);
  thresholdsCache = null;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    thresholdInfo: Number(row.threshold_info ?? input.thresholdInfo),
    thresholdWarning: Number(row.threshold_warning ?? input.thresholdWarning),
    thresholdCritical: Number(row.threshold_critical ?? input.thresholdCritical),
    clinicSnoozeDays: Number(row.clinic_snooze_days ?? input.clinicSnoozeDays) || 14,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

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
  /** When false, skip writing recommendation rows (used by bulk refresh). Default true. */
  persistRecommendations?: boolean;
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
  const persistRecommendations = params.persistRecommendations !== false;
  const matrix = await loadPlanCatalogMatrix();
  const maps = matrixToEngineMaps(matrix);
  const thresholds = await loadRecommendationThresholds();

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
      thresholds,
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
  if (persistRecommendations) {
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
  }

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

/**
 * Walk all clinics, recompute recommendations, and persist advisory rows.
 * Does not change subscriptions.
 */
export async function refreshAllPlanRecommendations(options?: {
  maxOrgs?: number;
  pageSize?: number;
}): Promise<{ scanned: number; recommended: number; cleared: number; pages: number }> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const pageSize = Math.min(100, Math.max(10, options?.pageSize ?? 50));
  const maxOrgs = Math.max(1, options?.maxOrgs ?? 5000);
  let page = 1;
  let scanned = 0;
  let recommended = 0;
  let cleared = 0;
  let pages = 0;
  let total = Number.POSITIVE_INFINITY;

  while (scanned < maxOrgs && scanned < total) {
    const batch = await listSuperadminOrganizationsWithRecommendations({
      page,
      pageSize,
      persistRecommendations: false,
    });
    pages += 1;
    total = batch.total;
    if (batch.rows.length === 0) break;

    for (const row of batch.rows) {
      scanned += 1;
      const rec = row.recommendation;
      try {
        if (rec.status === 'recommended' && rec.shouldRecommendUpgrade) {
          await persistPlanRecommendation(rec, 'recommended');
          recommended += 1;
        } else if (rec.status === 'none') {
          const { data: clearData, error: clearError } = await supabase.rpc(
            'superadmin_clear_idle_plan_recommendation',
            { p_organization_id: row.id }
          );
          if (!clearError && clearData && typeof clearData === 'object' && (clearData as { cleared?: boolean }).cleared) {
            cleared += 1;
          }
        }
      } catch {
        // Continue remaining orgs if one upsert fails.
      }
      if (scanned >= maxOrgs) break;
    }

    if (batch.rows.length < pageSize) break;
    page += 1;
  }

  return { scanned, recommended, cleared, pages };
}

export function recommendationsToCsv(rows: SuperadminOrgRecommendationRow[]): string {
  return formatRecommendationsCsv(
    rows.map((row) => ({
      clinicName: row.name,
      slug: row.slug,
      ownerName: row.ownerName,
      currentPlan: row.planKey,
      subscriptionStatus: row.status,
      usersUsed: row.usersUsed,
      branchesUsed: row.branchesUsed,
      patientsUsed: row.patientsUsed,
      usageLevel: row.recommendation.usageLevel,
      recommendedPlan: row.recommendation.recommendedPlan,
      upgradeStatus: row.recommendation.upgradeStatus,
      severity: row.recommendation.severity,
      reasons: row.recommendation.reasons,
    }))
  );
}

export async function exportRecommendationsCsv(params: {
  search?: string;
  planKey?: string;
  status?: string;
  recommendedPlan?: string;
  upgradeFilter?: string;
  sort?: string;
  maxRows?: number;
}): Promise<{ csv: string; rowCount: number }> {
  await requireSuperadmin();
  const pageSize = 100;
  const maxRows = Math.min(5000, Math.max(1, params.maxRows ?? 2000));
  const all: SuperadminOrgRecommendationRow[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (all.length < maxRows && all.length < total) {
    const batch = await listSuperadminOrganizationsWithRecommendations({
      search: params.search,
      planKey: params.planKey,
      status: params.status,
      recommendedPlan: params.recommendedPlan,
      upgradeFilter: params.upgradeFilter,
      sort: params.sort,
      page,
      pageSize,
      persistRecommendations: false,
    });
    total = batch.total;
    if (batch.rows.length === 0) break;
    all.push(...batch.rows);
    if (batch.rows.length < pageSize) break;
    page += 1;
  }

  const trimmed = all.slice(0, maxRows);
  return { csv: recommendationsToCsv(trimmed), rowCount: trimmed.length };
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
  frozen?: number;
  followUpsOpen?: number;
  followUpsOverdue?: number;
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
    frozen: num('frozen'),
    followUpsOpen: num('follow_ups_open'),
    followUpsOverdue: num('follow_ups_overdue'),
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
  const thresholds = await loadRecommendationThresholds();
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
      thresholds,
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
    thresholds,
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
  try {
    await supabase.rpc('superadmin_touch_plan_recommendation_refresh', {
      p_organization_id: recommendation.organizationId,
    });
  } catch {
    // Phase 34 optional until applied.
  }
}

export type PlanRecommendationCommercialMeta = {
  commercialNote: string | null;
  commercialNoteUpdatedAt: string | null;
  lastRefreshedAt: string | null;
  followUpAt: string | null;
  followUpBy: string | null;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenNote: string | null;
  status: string | null;
};

export async function getPlanRecommendationCommercialMeta(
  organizationId: string
): Promise<PlanRecommendationCommercialMeta> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_get_plan_recommendation_note', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    commercialNote: typeof row.commercial_note === 'string' ? row.commercial_note : null,
    commercialNoteUpdatedAt:
      typeof row.commercial_note_updated_at === 'string' ? row.commercial_note_updated_at : null,
    lastRefreshedAt: typeof row.last_refreshed_at === 'string' ? row.last_refreshed_at : null,
    followUpAt: typeof row.follow_up_at === 'string' ? row.follow_up_at : null,
    followUpBy: typeof row.follow_up_by === 'string' ? row.follow_up_by : null,
    isFrozen: Boolean(row.is_frozen),
    frozenAt: typeof row.frozen_at === 'string' ? row.frozen_at : null,
    frozenNote: typeof row.frozen_note === 'string' ? row.frozen_note : null,
    status: typeof row.status === 'string' ? row.status : null,
  };
}

export async function setPlanRecommendationCommercialNote(
  organizationId: string,
  note: string | null
): Promise<void> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('superadmin_set_plan_recommendation_note', {
    p_organization_id: organizationId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function setPlanRecommendationFollowUp(
  organizationId: string,
  followUpAt: string | null
): Promise<void> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('superadmin_set_plan_recommendation_follow_up', {
    p_organization_id: organizationId,
    p_follow_up_at: followUpAt,
  });
  if (error) throw new Error(error.message);
}

export async function setPlanRecommendationFreeze(
  organizationId: string,
  frozen: boolean,
  note?: string | null
): Promise<void> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('superadmin_set_plan_recommendation_freeze', {
    p_organization_id: organizationId,
    p_frozen: frozen,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export type RecommendationFollowUpRow = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  currentPlanKey: string | null;
  recommendedPlanKey: string | null;
  status: string;
  severity: string;
  usageLevel: number;
  followUpAt: string;
  commercialNote: string | null;
};

export async function listRecommendationFollowUps(
  limit = 25
): Promise<RecommendationFollowUpRow[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_recommendation_follow_ups', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    currentPlanKey: row.current_plan_key,
    recommendedPlanKey: row.recommended_plan_key,
    status: row.status,
    severity: row.severity,
    usageLevel: Number(row.usage_level) || 0,
    followUpAt: row.follow_up_at,
    commercialNote: row.commercial_note,
  }));
}

export function formatFollowUpsCsv(rows: RecommendationFollowUpRow[]): string {
  const header = [
    'clinic',
    'slug',
    'current_plan',
    'recommended_plan',
    'status',
    'severity',
    'usage_level',
    'follow_up_at',
    'overdue',
    'commercial_note',
  ];
  const lines = [header.join(',')];
  const now = Date.now();
  for (const row of rows) {
    const overdue = new Date(row.followUpAt).getTime() < now ? 'yes' : 'no';
    const esc = (value: string) => {
      if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    lines.push(
      [
        esc(row.organizationName),
        esc(row.organizationSlug),
        esc(row.currentPlanKey ?? ''),
        esc(row.recommendedPlanKey ?? ''),
        esc(row.status),
        esc(row.severity),
        String(row.usageLevel),
        esc(row.followUpAt),
        overdue,
        esc(row.commercialNote ?? ''),
      ].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
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
  gainsPreview: string[];
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
    const currentPlan = typeof row.current_plan_key === 'string' ? row.current_plan_key : null;

    let gainsPreview: string[] = [];
    if (recommended === 'pro') {
      gainsPreview = ['Inventario', 'Internación / cirugía', 'Facturación y caja', 'Reportes'];
    } else if (recommended === 'premium') {
      gainsPreview = ['IA clínica', 'WhatsApp', 'Imágenes clínicas', 'Reportes avanzados'];
    } else if (recommended === 'enterprise') {
      gainsPreview = ['Límites a medida', 'Operación multi-sucursal', 'Acompañamiento comercial'];
    }

    return {
      currentPlan,
      recommendedPlan: recommended as PaidPlanKey,
      reasons,
      severity: typeof row.severity === 'string' ? row.severity : 'info',
      usageLevel: Number(row.usage_level ?? 0) || 0,
      fingerprint: typeof row.fingerprint === 'string' ? row.fingerprint : null,
      gainsPreview,
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
