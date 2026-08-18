import {
  isBillingProvider,
  isPurchasableAddonKey,
  isPurchasablePlanKey,
  type BillingInterval,
  type BillingProvider,
  type SubscriptionStatus,
} from '@sincvete/shared';
import type { Json } from '@sincvete/db';
import { createServiceClient } from '@/lib/supabase/server';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertOrgId(organizationId: string) {
  if (!UUID_RE.test(organizationId)) {
    throw new Error('organización inválida');
  }
}

export async function claimBillingEvent(params: {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ id: string; alreadyApplied: boolean }> {
  const service = await createServiceClient();
  const { data, error } = await service.rpc('billing_begin_event', {
    p_provider: params.provider,
    p_event_id: params.eventId,
    p_event_type: params.eventType,
    p_organization_id: params.organizationId ?? null,
    p_payload: params.payload as Json,
  });
  if (error) throw new Error(error.message);
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const id = typeof row?.id === 'string' ? row.id : null;
  if (!id) throw new Error('no se pudo registrar el evento de pago');
  return { id, alreadyApplied: row?.already_applied === true };
}

export async function finishBillingEvent(eventRowId: string): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.rpc('billing_finish_event', {
    p_event_row_id: eventRowId,
  });
  if (error) throw new Error(error.message);
}

export async function findOrganizationIdByStripeCustomer(
  customerId: string | null | undefined
): Promise<string | null> {
  if (!customerId) return null;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('billing_customers')
    .select('organization_id')
    .eq('provider', 'stripe')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.organization_id ?? null;
}

export async function upsertBillingCustomer(params: {
  organizationId: string;
  provider: BillingProvider;
  customerId: string;
  email?: string | null;
}): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.from('billing_customers').upsert({
    organization_id: params.organizationId,
    provider: params.provider,
    customer_id: params.customerId,
    email: params.email ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function applyPaidPlan(params: {
  organizationId: string;
  planKey: string;
  provider: BillingProvider;
  externalId: string;
  interval: BillingInterval;
  status?: Extract<SubscriptionStatus, 'active' | 'past_due'>;
}): Promise<void> {
  if (!isPurchasablePlanKey(params.planKey) || !isBillingProvider(params.provider)) {
    throw new Error('Checkout inválido');
  }
  assertOrgId(params.organizationId);
  const service = await createServiceClient();
  const { error } = await service.rpc('billing_apply_paid_plan', {
    p_organization_id: params.organizationId,
    p_plan_key: params.planKey,
    p_provider: params.provider,
    p_external_id: params.externalId,
    p_interval: params.interval,
    p_status: params.status ?? 'active',
  });
  if (error) throw new Error(error.message);
}

export async function applyPaidAddon(params: {
  organizationId: string;
  addonKey: string;
  provider: BillingProvider;
  externalId: string;
  interval: BillingInterval;
}): Promise<void> {
  if (!isPurchasableAddonKey(params.addonKey) || !isBillingProvider(params.provider)) {
    throw new Error('Checkout de extra inválido');
  }
  assertOrgId(params.organizationId);
  const service = await createServiceClient();
  const { error } = await service.rpc('billing_apply_paid_addon', {
    p_organization_id: params.organizationId,
    p_addon_key: params.addonKey,
    p_provider: params.provider,
    p_external_id: params.externalId,
    p_interval: params.interval,
  });
  if (error) throw new Error(error.message);
}

export async function extendPaidPlanPeriod(params: {
  organizationId?: string | null;
  stripeCustomerId?: string | null;
  interval?: BillingInterval;
  provider?: BillingProvider;
  externalId?: string;
}): Promise<boolean> {
  const service = await createServiceClient();
  const organizationId =
    params.organizationId ?? (await findOrganizationIdByStripeCustomer(params.stripeCustomerId));
  if (!organizationId) return false;
  assertOrgId(organizationId);
  const { error } = await service.rpc('billing_extend_paid_plan', {
    p_organization_id: organizationId,
    p_interval: params.interval ?? 'monthly',
    p_provider: params.provider ?? 'stripe',
    p_external_id: params.externalId ?? null,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function setPaidSubscriptionStatus(params: {
  organizationId: string;
  status: Extract<SubscriptionStatus, 'active' | 'past_due' | 'cancelled' | 'expired'>;
  provider?: BillingProvider;
  externalId?: string;
}): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.rpc('billing_set_subscription_status', {
    p_organization_id: params.organizationId,
    p_status: params.status,
    p_provider: params.provider ?? null,
    p_external_id: params.externalId ?? null,
  });
  if (error) throw new Error(error.message);
}
