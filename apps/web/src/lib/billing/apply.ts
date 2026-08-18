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

export async function recordBillingEvent(params: {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ duplicate: boolean }> {
  const service = await createServiceClient();
  const { error } = await service.from('billing_events').insert({
    provider: params.provider,
    event_id: params.eventId,
    event_type: params.eventType,
    organization_id: params.organizationId ?? null,
    payload: params.payload as Json,
  });
  if (error?.code === '23505') return { duplicate: true };
  if (error) throw new Error(error.message);
  return { duplicate: false };
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
