'use server';

import { revalidatePath } from 'next/cache';
import {
  buildPaginatedResult,
  canSuperadminAssignPlan,
  COMMERCIAL_QUOTA_WARN_RATIO,
  COMMERCIAL_TRIAL_REMIND_DAYS,
  findSeatDowngradeBlockers,
  formatSeatAssignmentMessage,
  getResolvedFeatureLimit,
  isFeatureKey,
  isLegacyPlanKey,
  isSeatFeatureKey,
  resolveOrganizationEntitlements,
  METERED_FEATURE_KEYS,
  METERED_USAGE_LABELS,
  SEAT_FEATURE_KEYS,
  SEAT_USAGE_LABELS,
  utcMonthPeriod,
  type ActionResult,
  type AddonFeatureRow,
  type EntitlementResolutionInput,
  type FeatureCatalogRow,
  type FeatureOverrideRow,
  type OrganizationEntitlements,
  type PaginatedResult,
  type PlanFeatureRow,
  type SeatUsageMeter,
  type MeteredUsageMeter,
  type SubscriptionStatus,
} from '@sincvete/shared';
import type { Json } from '@sincvete/db';
import { PermissionError, requireSuperadmin } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase/server';
import { replayClaimedBillingEvent } from '@/lib/billing/dispatch';

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message ?? '');
    if (message) return { success: false, error: message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function revalidateOrg(organizationId: string) {
  revalidatePath('/superadmin');
  revalidatePath(`/superadmin/organizaciones/${organizationId}`);
  revalidatePath('/configuracion');
  revalidatePath('/', 'layout');
}

async function clearOrgCheckoutIntents(organizationId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('superadmin_cancel_checkout_intents', {
    p_organization_id: organizationId,
  });
  if (error) {
    console.error('[superadmin] clear checkout intents', error.message);
  }
}

export type SuperadminOrgListRow = {
  id: string;
  name: string;
  slug: string;
  planKey: string | null;
  planName: string | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  startsAt: string | null;
  createdAt: string;
};

export async function listSuperadminOrganizations(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  planKey?: string;
  status?: string;
}): Promise<PaginatedResult<SuperadminOrgListRow>> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const { data, error } = await supabase.rpc('superadmin_list_organizations', {
    p_search: params.search?.trim() || null,
    p_page: page,
    p_page_size: pageSize,
    p_plan_key: params.planKey?.trim() || null,
    p_status: params.status?.trim() || null,
  });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  return buildPaginatedResult(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      planKey: row.plan_key,
      planName: row.plan_name,
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      startsAt: row.starts_at,
      createdAt: row.created_at,
    })),
    Number(total),
    page,
    pageSize
  );
}

export type SuperadminPlanOption = {
  key: string;
  name: string;
  isInternal: boolean;
  isPublic: boolean;
};

export type SuperadminOverrideRow = FeatureOverrideRow & {
  id: string;
  reason: string | null;
  updatedAt: string;
};

export type SuperadminUsageRow = {
  featureKey: string;
  periodStart: string;
  periodEnd: string;
  usageCount: number;
};

export type SuperadminAddonOption = {
  key: string;
  name: string;
  description: string | null;
};

export type SuperadminOrgAddonRow = {
  id: string;
  addonKey: string;
  addonName: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
};

export type SuperadminOrgCommercial = {
  organization: { id: string; name: string; slug: string; createdAt: string };
  subscription: {
    id: string;
    planKey: string;
    planName: string;
    status: SubscriptionStatus;
    startsAt: string;
    trialEndsAt: string | null;
    isInternal: boolean;
  } | null;
  plans: SuperadminPlanOption[];
  catalog: Array<{ key: string; name: string; featureType: 'boolean' | 'limit'; usageMetered: boolean }>;
  addonCatalog: SuperadminAddonOption[];
  organizationAddons: SuperadminOrgAddonRow[];
  entitlements: OrganizationEntitlements;
  overrides: SuperadminOverrideRow[];
  usage: SuperadminUsageRow[];
  seats: SeatUsageMeter[];
  meters: MeteredUsageMeter[];
};

function asObject(value: Json | null | undefined): Record<string, Json | undefined> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function asString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: Json | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: Json | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function asFeatureType(value: Json | undefined): 'boolean' | 'limit' {
  return asString(value) === 'limit' ? 'limit' : 'boolean';
}

function asSubscriptionStatus(value: Json | undefined): SubscriptionStatus | null {
  const status = asString(value);
  if (
    status === 'trialing' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'cancelled' ||
    status === 'expired'
  ) {
    return status;
  }
  return null;
}

/** datetime-local has no timezone; Superadmin UI labels these fields as UTC. */
function formDateToTimestamptz(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}Z`;
  }
  return trimmed;
}

function seatLimitsFromRows(
  rows: { feature_key: string; enabled: boolean; limit_value: number | null }[] | null
): Record<string, number | null> {
  const limits: Record<string, number | null> = {};
  for (const row of rows ?? []) {
    if (!isSeatFeatureKey(row.feature_key)) continue;
    if (row.enabled === false) {
      limits[row.feature_key] = 0;
      continue;
    }
    limits[row.feature_key] = row.limit_value === null ? null : Number(row.limit_value);
  }
  return limits;
}

async function superadminSeatAssignmentError(params: {
  organizationId: string;
  planKey: string;
  planName?: string | null;
  currentPlanKey?: string | null;
  allowOverSeats: boolean;
}): Promise<string | null> {
  if (params.allowOverSeats || isLegacyPlanKey(params.planKey)) return null;
  if (params.currentPlanKey && params.currentPlanKey === params.planKey) return null;
  const supabase = await createServerClient();
  const [usageRes, limitsRes] = await Promise.all([
    supabase.rpc('superadmin_list_org_seat_usage', { p_organization_id: params.organizationId }),
    supabase.rpc('list_plan_seat_limits', { p_plan_key: params.planKey }),
  ]);
  if (usageRes.error || limitsRes.error) {
    return 'No se pudieron verificar los cupos de la clínica.';
  }
  const usedByKey = Object.fromEntries(
    (usageRes.data ?? []).map((row) => [row.feature_key, Number(row.used) || 0])
  );
  const blockers = findSeatDowngradeBlockers({
    usedByKey,
    targetLimits: seatLimitsFromRows(limitsRes.data),
  });
  if (blockers.length === 0) return null;
  return formatSeatAssignmentMessage(blockers, params.planName || params.planKey);
}

export async function getSuperadminOrgCommercial(
  organizationId: string
): Promise<SuperadminOrgCommercial> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_get_org_commercial', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const bundle = asObject(data);
  if (!bundle) throw new Error('Respuesta comercial inválida');

  const seatsRes = await supabase.rpc('superadmin_list_org_seat_usage', {
    p_organization_id: organizationId,
  });

  const org = asObject(bundle.organization);
  if (!org?.id || !asString(org.id)) throw new Error('Organización inválida');

  const subscriptionRaw = asObject(bundle.subscription);
  const catalogJson = asArray(bundle.catalog);
  const planFeaturesJson = asArray(bundle.plan_features);
  const addonFeaturesJson = asArray(bundle.addon_features);
  const overridesJson = asArray(bundle.overrides);

  const features: FeatureCatalogRow[] = catalogJson.flatMap((row) => {
    const item = asObject(row);
    const key = asString(item?.key);
    if (!item || !key) return [];
    const featureType = asFeatureType(item.feature_type);
    return [
      {
        key,
        featureType,
        defaultEnabled: asBoolean(item.default_enabled) ?? false,
        defaultLimit: asNumber(item.default_limit),
        isActive: asBoolean(item.is_active) ?? true,
      },
    ];
  });

  const catalog = catalogJson.flatMap((row) => {
    const item = asObject(row);
    const key = asString(item?.key);
    const name = asString(item?.name);
    if (!item || !key || !name) return [];
    return [
      {
        key,
        name,
        featureType: asFeatureType(item.feature_type),
        usageMetered: asBoolean(item.usage_metered) ?? false,
      },
    ];
  });

  const planFeatures: PlanFeatureRow[] = planFeaturesJson.flatMap((row) => {
    const item = asObject(row);
    const featureKey = asString(item?.feature_key);
    if (!item || !featureKey) return [];
    return [
      {
        featureKey,
        enabled: asBoolean(item.enabled) ?? false,
        limitValue: asNumber(item.limit_value),
      },
    ];
  });

  const addonFeatures: AddonFeatureRow[] = addonFeaturesJson.flatMap((row) => {
    const item = asObject(row);
    const featureKey = asString(item?.feature_key);
    if (!item || !featureKey) return [];
    return [
      {
        featureKey,
        enabled: asBoolean(item.enabled) ?? false,
        limitValue: asNumber(item.limit_value),
      },
    ];
  });

  const overrides: SuperadminOverrideRow[] = overridesJson.flatMap((row) => {
    const item = asObject(row);
    const featureKey = asString(item?.feature_key);
    const id = asString(item?.id);
    if (!item || !featureKey || !id) return [];
    return [
      {
        id,
        featureKey,
        enabled: asBoolean(item.enabled),
        limitValue: asNumber(item.limit_value),
        startsAt: asString(item.starts_at),
        endsAt: asString(item.ends_at),
        reason: asString(item.reason),
        updatedAt: asString(item.updated_at) ?? '',
      },
    ];
  });

  const input: EntitlementResolutionInput = {
    features,
    planFeatures,
    addonFeatures,
    overrides,
    hasActiveSubscription: Boolean(subscriptionRaw),
  };

  const plans: SuperadminPlanOption[] = asArray(bundle.plans).flatMap((row) => {
    const item = asObject(row);
    const key = asString(item?.key);
    const name = asString(item?.name);
    if (!item || !key || !name) return [];
    return [
      {
        key,
        name,
        isInternal: asBoolean(item.is_internal) ?? false,
        isPublic: asBoolean(item.is_public) ?? false,
      },
    ];
  });

  const addonCatalog: SuperadminAddonOption[] = asArray(bundle.addon_catalog).flatMap((row) => {
    const item = asObject(row);
    const key = asString(item?.key);
    const name = asString(item?.name);
    if (!item || !key || !name) return [];
    return [{ key, name, description: asString(item.description) }];
  });

  const organizationAddons: SuperadminOrgAddonRow[] = asArray(bundle.organization_addons).flatMap(
    (row) => {
      const item = asObject(row);
      const id = asString(item?.id);
      const addonKey = asString(item?.addon_key);
      const addonName = asString(item?.addon_name);
      const status = asSubscriptionStatus(item?.status);
      if (!item || !id || !addonKey || !addonName || !status) return [];
      return [
        {
          id,
          addonKey,
          addonName,
          status,
          startsAt: asString(item.starts_at) ?? '',
          endsAt: asString(item.ends_at),
          reason: asString(item.reason),
        },
      ];
    }
  );

  const usage: SuperadminUsageRow[] = asArray(bundle.usage).flatMap((row) => {
    const item = asObject(row);
    const featureKey = asString(item?.feature_key);
    if (!item || !featureKey) return [];
    return [
      {
        featureKey,
        periodStart: asString(item.period_start) ?? '',
        periodEnd: asString(item.period_end) ?? '',
        usageCount: asNumber(item.usage_count) ?? 0,
      },
    ];
  });

  const status = asSubscriptionStatus(subscriptionRaw?.status);
  const entitlements = resolveOrganizationEntitlements(input);
  const usedByKey = new Map<string, number>();
  for (const row of seatsRes.data ?? []) {
    usedByKey.set(row.feature_key, Number(row.used) || 0);
  }
  const seats: SeatUsageMeter[] = SEAT_FEATURE_KEYS.map((featureKey) => ({
    featureKey,
    label: SEAT_USAGE_LABELS[featureKey] ?? featureKey,
    used: usedByKey.get(featureKey) ?? 0,
    limit: getResolvedFeatureLimit(entitlements, featureKey),
  }));
  const period = utcMonthPeriod();
  const meterUsedByKey = new Map<string, number>();
  for (const row of usage) {
    if (row.periodStart === period.start) {
      meterUsedByKey.set(row.featureKey, row.usageCount);
    }
  }
  const meters: MeteredUsageMeter[] = METERED_FEATURE_KEYS.map((featureKey) => ({
    featureKey,
    label: METERED_USAGE_LABELS[featureKey] ?? featureKey,
    used: meterUsedByKey.get(featureKey) ?? 0,
    limit: getResolvedFeatureLimit(entitlements, featureKey),
  }));

  return {
    organization: {
      id: asString(org.id)!,
      name: asString(org.name) ?? '',
      slug: asString(org.slug) ?? '',
      createdAt: asString(org.created_at) ?? '',
    },
    subscription: subscriptionRaw
      ? {
          id: asString(subscriptionRaw.id) ?? '',
          planKey: asString(subscriptionRaw.plan_key) ?? '',
          planName: asString(subscriptionRaw.plan_name) ?? '',
          status: status ?? 'active',
          startsAt: asString(subscriptionRaw.starts_at) ?? '',
          trialEndsAt: asString(subscriptionRaw.trial_ends_at),
          isInternal: asBoolean(subscriptionRaw.is_internal) ?? false,
        }
      : null,
    plans,
    catalog,
    addonCatalog,
    organizationAddons,
    entitlements,
    overrides,
    usage,
    seats,
    meters,
  };
}

export async function changeOrganizationPlan(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const planKey = String(formData.get('planKey') ?? '');
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const allowLegacy = formData.get('allowLegacy') === 'on';
    const allowOverSeats = formData.get('allowOverSeats') === 'on';
    if (!organizationId || !planKey) {
      return { success: false, error: 'Plan y organización son obligatorios' };
    }
    if (!canSuperadminAssignPlan(planKey, allowLegacy)) {
      return { success: false, error: 'Ese plan no se puede asignar' };
    }
    const commercial = await getSuperadminOrgCommercial(organizationId);
    const planName = commercial.plans.find((plan) => plan.key === planKey)?.name ?? planKey;
    const seatError = await superadminSeatAssignmentError({
      organizationId,
      planKey,
      planName,
      currentPlanKey: commercial.subscription?.planKey ?? null,
      allowOverSeats,
    });
    if (seatError) {
      return { success: false, error: seatError };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_change_plan', {
      p_organization_id: organizationId,
      p_plan_key: planKey,
      p_reason: reason,
      p_allow_legacy: allowLegacy,
      p_trial_days: null,
    });
    if (error) return { success: false, error: error.message };
    await clearOrgCheckoutIntents(organizationId);
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function startOrganizationTrial(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const daysRaw = String(formData.get('trialDays') ?? '').trim();
    const trialDays = daysRaw ? Number(daysRaw) : null;
    if (!organizationId) return { success: false, error: 'Organización inválida' };
    if (trialDays !== null && (!Number.isInteger(trialDays) || trialDays <= 0)) {
      return { success: false, error: 'Los días de trial deben ser un entero positivo' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_start_trial', {
      p_organization_id: organizationId,
      p_trial_days: trialDays,
      p_reason: reason,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function endOrganizationTrial(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const planKey = String(formData.get('planKey') ?? 'basic') || 'basic';
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const allowOverSeats = formData.get('allowOverSeats') === 'on';
    if (!organizationId) return { success: false, error: 'Organización inválida' };
    if (!canSuperadminAssignPlan(planKey, false) || planKey === 'trial') {
      return { success: false, error: 'Elegí un plan comercial para terminar el trial' };
    }
    const commercial = await getSuperadminOrgCommercial(organizationId);
    const planName = commercial.plans.find((plan) => plan.key === planKey)?.name ?? planKey;
    const seatError = await superadminSeatAssignmentError({
      organizationId,
      planKey,
      planName,
      currentPlanKey: commercial.subscription?.planKey ?? null,
      allowOverSeats,
    });
    if (seatError) {
      return { success: false, error: seatError };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_end_trial', {
      p_organization_id: organizationId,
      p_plan_key: planKey,
      p_reason: reason,
    });
    if (error) return { success: false, error: error.message };
    await clearOrgCheckoutIntents(organizationId);
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function setOrganizationFeatureOverride(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const featureKey = String(formData.get('featureKey') ?? '');
    const enabled = String(formData.get('enabled') ?? 'true') === 'true';
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const limitRaw = String(formData.get('limitValue') ?? '').trim();
    const startsAt = formDateToTimestamptz(String(formData.get('startsAt') ?? ''));
    const endsAt = formDateToTimestamptz(String(formData.get('endsAt') ?? ''));
    if (!organizationId || !isFeatureKey(featureKey)) {
      return { success: false, error: 'Feature u organización inválida' };
    }
    const limitValue = limitRaw === '' ? null : Number(limitRaw);
    if (limitValue !== null && !Number.isFinite(limitValue)) {
      return { success: false, error: 'Límite inválido' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_set_feature_override', {
      p_organization_id: organizationId,
      p_feature_key: featureKey,
      p_enabled: enabled,
      p_limit_value: limitValue,
      p_reason: reason,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function clearOrganizationFeatureOverride(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const featureKey = String(formData.get('featureKey') ?? '');
    const reason = String(formData.get('reason') ?? '').trim() || null;
    if (!organizationId || !isFeatureKey(featureKey)) {
      return { success: false, error: 'Feature u organización inválida' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_clear_feature_override', {
      p_organization_id: organizationId,
      p_feature_key: featureKey,
      p_reason: reason,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function grantOrganizationAddon(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const addonKey = String(formData.get('addonKey') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const startsAt = formDateToTimestamptz(String(formData.get('startsAt') ?? ''));
    const endsAt = formDateToTimestamptz(String(formData.get('endsAt') ?? ''));
    if (!organizationId || !addonKey) {
      return { success: false, error: 'Add-on y organización son obligatorios' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_grant_addon', {
      p_organization_id: organizationId,
      p_addon_key: addonKey,
      p_reason: reason,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeOrganizationAddon(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const addonKey = String(formData.get('addonKey') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim() || null;
    if (!organizationId || !addonKey) {
      return { success: false, error: 'Add-on y organización son obligatorios' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_revoke_addon', {
      p_organization_id: organizationId,
      p_addon_key: addonKey,
      p_reason: reason,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export type SuperadminCommercialSummary = {
  organizations: number;
  trialing: number;
  active: number;
  pastDue: number;
  expired: number;
  cancelled: number;
  plansEndingSoon: number;
  addonsActive: number;
  addonsEndingSoon: number;
  orgsOverSeats: number;
  billingEventsPending: number;
  checkoutIntentsOpen: number;
};

export async function getSuperadminCommercialSummary(): Promise<SuperadminCommercialSummary> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const [summaryRes, pendingRes, intentsRes] = await Promise.all([
    supabase.rpc('superadmin_commercial_summary', {
      p_remind_days: COMMERCIAL_TRIAL_REMIND_DAYS,
    }),
    supabase.rpc('superadmin_pending_billing_events'),
    supabase.rpc('superadmin_open_checkout_intents'),
  ]);
  if (summaryRes.error) throw new Error(summaryRes.error.message);
  if (pendingRes.error) throw new Error(pendingRes.error.message);
  if (intentsRes.error) throw new Error(intentsRes.error.message);
  const row = asObject(summaryRes.data);
  return {
    organizations: asNumber(row?.organizations) ?? 0,
    trialing: asNumber(row?.trialing) ?? 0,
    active: asNumber(row?.active) ?? 0,
    pastDue: asNumber(row?.past_due) ?? 0,
    expired: asNumber(row?.expired) ?? 0,
    cancelled: asNumber(row?.cancelled) ?? 0,
    plansEndingSoon: asNumber(row?.plans_ending_soon) ?? 0,
    addonsActive: asNumber(row?.addons_active) ?? 0,
    addonsEndingSoon: asNumber(row?.addons_ending_soon) ?? 0,
    orgsOverSeats: asNumber(row?.orgs_over_seats) ?? 0,
    billingEventsPending: asNumber(pendingRes.data) ?? 0,
    checkoutIntentsOpen: asNumber(intentsRes.data) ?? 0,
  };
}

export async function runSuperadminCommercialLifecycle(): Promise<
  ActionResult<{ expired: number; notices: number }>
> {
  try {
    await requireSuperadmin();
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('run_commercial_lifecycle', {
      p_trial_remind_days: COMMERCIAL_TRIAL_REMIND_DAYS,
      p_quota_warn_ratio: COMMERCIAL_QUOTA_WARN_RATIO,
    });
    if (error) return { success: false, error: error.message };
    const row = asObject(data);
    revalidatePath('/superadmin');
    return {
      success: true,
      data: {
        expired: asNumber(row?.expired) ?? 0,
        notices: asNumber(row?.notices) ?? 0,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export type SuperadminBillingEvent = {
  id: string;
  provider: string;
  eventId: string;
  eventType: string | null;
  processedAt: string;
  appliedAt: string | null;
};

export async function listSuperadminBillingEvents(
  organizationId: string
): Promise<SuperadminBillingEvent[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_billing_events', {
    p_organization_id: organizationId,
    p_limit: 25,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    processedAt: row.processed_at,
    appliedAt: row.applied_at,
  }));
}

export type SuperadminCheckoutIntent = {
  id: string;
  kind: string;
  targetKey: string;
  interval: string;
  provider: string;
  expiresAt: string;
  createdAt: string;
};

export async function listSuperadminCheckoutIntents(
  organizationId: string
): Promise<SuperadminCheckoutIntent[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_checkout_intents', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    targetKey: row.target_key,
    interval: row.billing_interval,
    provider: row.provider,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function cancelSuperadminCheckoutIntents(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    if (!organizationId) return { success: false, error: 'Organización inválida' };
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_cancel_checkout_intents', {
      p_organization_id: organizationId,
    });
    if (error) return { success: false, error: error.message };
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

function revalidateBillingEvent(organizationId: string | null | undefined) {
  if (organizationId) {
    revalidateOrg(organizationId);
    return;
  }
  revalidatePath('/superadmin');
}

export async function replaySuperadminBillingEvent(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const eventId = String(formData.get('eventId') ?? '').trim();
    if (!eventId) return { success: false, error: 'Evento inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_get_unapplied_billing_event', {
      p_event_id: eventId,
    });
    if (error) return { success: false, error: error.message };
    const row = data?.[0];
    if (!row) return { success: false, error: 'El evento ya se aplicó o no existe' };
    await replayClaimedBillingEvent({
      eventRowId: row.id,
      provider: row.provider,
      payload: row.payload,
    });
    revalidateBillingEvent(row.organization_id);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function skipSuperadminBillingEvent(
  formData: FormData
): Promise<ActionResult<{ released: number }>> {
  try {
    await requireSuperadmin();
    const eventId = String(formData.get('eventId') ?? '').trim();
    if (!eventId) return { success: false, error: 'Evento inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_skip_billing_event', {
      p_event_id: eventId,
    });
    if (error) return { success: false, error: error.message };
    const row = asObject(data);
    if ((asNumber(row?.skipped) ?? 0) < 1) {
      return { success: false, error: 'El evento ya se aplicó o no existe' };
    }
    revalidateBillingEvent(asString(row?.organization_id));
    return { success: true, data: { released: asNumber(row?.released) ?? 0 } };
  } catch (error) {
    return actionError(error);
  }
}

export type SuperadminOpenCheckoutIntentRow = SuperadminCheckoutIntent & {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export async function listSuperadminOpenCheckoutIntents(): Promise<SuperadminOpenCheckoutIntentRow[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_open_checkout_intents', {
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    kind: row.kind,
    targetKey: row.target_key,
    interval: row.billing_interval,
    provider: row.provider,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export type SuperadminUnappliedBillingEvent = SuperadminBillingEvent & {
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
};

export async function listSuperadminUnappliedBillingEvents(): Promise<
  SuperadminUnappliedBillingEvent[]
> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_unapplied_billing_events', {
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    processedAt: row.processed_at,
    appliedAt: null,
  }));
}

export type SuperadminPlanEndingSoonRow = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  planKey: string;
  planName: string;
  status: string;
  endsAt: string;
};

export async function listSuperadminPlansEndingSoon(): Promise<SuperadminPlanEndingSoonRow[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_plans_ending_soon', {
    p_remind_days: COMMERCIAL_TRIAL_REMIND_DAYS,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    planKey: row.plan_key,
    planName: row.plan_name,
    status: row.status,
    endsAt: row.ends_at,
  }));
}

export type SuperadminAddonEndingSoonRow = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  addonKey: string;
  addonName: string;
  endsAt: string;
};

export async function listSuperadminAddonsEndingSoon(): Promise<SuperadminAddonEndingSoonRow[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_addons_ending_soon', {
    p_remind_days: COMMERCIAL_TRIAL_REMIND_DAYS,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    addonKey: row.addon_key,
    addonName: row.addon_name,
    endsAt: row.ends_at,
  }));
}

export type SuperadminOrgOverSeatsRow = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  planKey: string;
  planName: string;
  featureKey: string;
  used: number;
  limitValue: number;
};

export async function listSuperadminOrgsOverSeats(): Promise<SuperadminOrgOverSeatsRow[]> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_list_orgs_over_seats', {
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    organizationSlug: row.organization_slug,
    planKey: row.plan_key,
    planName: row.plan_name,
    featureKey: row.feature_key,
    used: Number(row.used),
    limitValue: Number(row.limit_value),
  }));
}

export async function reverseSuperadminPaidGrant(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const kind = String(formData.get('kind') ?? '').trim();
    const targetKey = String(formData.get('targetKey') ?? '').trim() || null;
    if (!organizationId || (kind !== 'plan' && kind !== 'addon')) {
      return { success: false, error: 'Organización y tipo son obligatorios' };
    }
    if (kind === 'addon' && !targetKey) {
      return { success: false, error: 'El extra es obligatorio' };
    }
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('billing_reverse_paid_grant', {
      p_organization_id: organizationId,
      p_kind: kind,
      p_target_key: targetKey,
      p_reason: 'superadmin_refund',
    });
    if (error) return { success: false, error: error.message };
    const row = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    const reversed = typeof row?.reversed === 'number' ? row.reversed : 0;
    if (reversed < 1) {
      return { success: false, error: 'No había un cobro de checkout para revertir' };
    }
    revalidateOrg(organizationId);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}
