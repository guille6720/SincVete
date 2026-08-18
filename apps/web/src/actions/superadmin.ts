'use server';

import { revalidatePath } from 'next/cache';
import {
  buildPaginatedResult,
  canSuperadminAssignPlan,
  isFeatureKey,
  resolveOrganizationEntitlements,
  type ActionResult,
  type EntitlementResolutionInput,
  type FeatureCatalogRow,
  type FeatureOverrideRow,
  type OrganizationEntitlements,
  type PaginatedResult,
  type PlanFeatureRow,
  type SubscriptionStatus,
} from '@sincvete/shared';
import type { Json } from '@sincvete/db';
import { PermissionError, requireSuperadmin } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase/server';

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
  entitlements: OrganizationEntitlements;
  overrides: SuperadminOverrideRow[];
  usage: SuperadminUsageRow[];
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

  const org = asObject(bundle.organization);
  if (!org?.id || !asString(org.id)) throw new Error('Organización inválida');

  const subscriptionRaw = asObject(bundle.subscription);
  const catalogJson = asArray(bundle.catalog);
  const planFeaturesJson = asArray(bundle.plan_features);
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
    entitlements: resolveOrganizationEntitlements(input),
    overrides,
    usage,
  };
}

export async function changeOrganizationPlan(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const organizationId = String(formData.get('organizationId') ?? '');
    const planKey = String(formData.get('planKey') ?? '');
    const reason = String(formData.get('reason') ?? '').trim() || null;
    const allowLegacy = formData.get('allowLegacy') === 'on';
    if (!organizationId || !planKey) {
      return { success: false, error: 'Plan y organización son obligatorios' };
    }
    if (!canSuperadminAssignPlan(planKey, allowLegacy)) {
      return { success: false, error: 'Ese plan no se puede asignar' };
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
    if (!organizationId) return { success: false, error: 'Organización inválida' };
    if (!canSuperadminAssignPlan(planKey, false) || planKey === 'trial') {
      return { success: false, error: 'Elegí un plan comercial para terminar el trial' };
    }
    const supabase = await createServerClient();
    const { error } = await supabase.rpc('superadmin_end_trial', {
      p_organization_id: organizationId,
      p_plan_key: planKey,
      p_reason: reason,
    });
    if (error) return { success: false, error: error.message };
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

export type SuperadminCommercialSummary = {
  organizations: number;
  trialing: number;
  active: number;
  pastDue: number;
  expired: number;
  cancelled: number;
};

export async function getSuperadminCommercialSummary(): Promise<SuperadminCommercialSummary> {
  await requireSuperadmin();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('superadmin_commercial_summary');
  if (error) throw new Error(error.message);
  const row = asObject(data);
  return {
    organizations: asNumber(row?.organizations) ?? 0,
    trialing: asNumber(row?.trialing) ?? 0,
    active: asNumber(row?.active) ?? 0,
    pastDue: asNumber(row?.past_due) ?? 0,
    expired: asNumber(row?.expired) ?? 0,
    cancelled: asNumber(row?.cancelled) ?? 0,
  };
}

export async function runSuperadminCommercialLifecycle(): Promise<
  ActionResult<{ expired: number; notices: number }>
> {
  try {
    await requireSuperadmin();
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('run_commercial_lifecycle');
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
  }));
}
