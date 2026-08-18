'use server';

import { revalidatePath } from 'next/cache';
import {
  amountForInterval,
  canCheckoutPlan,
  canCancelOwnSubscription,
  isPurchasablePlanKey,
  METERED_FEATURE_KEYS,
  METERED_USAGE_LABELS,
  utcMonthPeriod,
  getResolvedFeatureLimit,
  type ActionResult,
  type BillingInterval,
  type PublicPlanCatalogItem,
  type SubscriptionStatus,
} from '@sincvete/shared';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase/server';
import { billingConfigured, resolveBillingProvider } from '@/lib/billing/crypto';
import { listPublicPlansCatalog } from '@/lib/billing/catalog';
import { createMercadoPagoCheckoutUrl } from '@/lib/billing/mercadopago';
import { createStripeBillingPortalUrl, createStripeCheckoutUrl } from '@/lib/billing/stripe';
import { getOrganizationEntitlements } from '@/lib/entitlements';

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error && error.message) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

export type PlanUsageMeter = {
  featureKey: string;
  label: string;
  used: number;
  limit: number | null;
};

export type PlanBillingState = {
  configured: boolean;
  provider: 'stripe' | 'mercadopago' | null;
  current: {
    planKey: string | null;
    planName: string | null;
    status: SubscriptionStatus | null;
    trialEndsAt: string | null;
    endsAt: string | null;
  };
  hasStripeCustomer: boolean;
  canCancel: boolean;
  plans: PublicPlanCatalogItem[];
  usage: PlanUsageMeter[];
};

export async function getPlanBillingState(): Promise<PlanBillingState> {
  const session = await requirePermission('org:manage');
  const supabase = await createServerClient();
  const period = utcMonthPeriod();
  const [plans, subRes, customerRes, entitlements, usageRes] = await Promise.all([
    listPublicPlansCatalog(),
    supabase
      .from('organization_subscriptions')
      .select('status, trial_ends_at, ends_at, plans!inner(key, name)')
      .eq('organization_id', session.organizationId)
      .in('status', ['trialing', 'active', 'past_due'])
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('billing_customers')
      .select('provider')
      .eq('organization_id', session.organizationId)
      .maybeSingle(),
    getOrganizationEntitlements(session.organizationId),
    supabase
      .from('feature_usage')
      .select('usage_count, features!inner(key)')
      .eq('organization_id', session.organizationId)
      .eq('period_start', period.start),
  ]);

  const planJoin = subRes.data?.plans as { key?: string; name?: string } | { key?: string; name?: string }[] | null;
  const planRow = Array.isArray(planJoin) ? planJoin[0] : planJoin;
  const usedByKey = new Map<string, number>();
  for (const row of usageRes.data ?? []) {
    const featureJoin = row.features as { key?: string } | { key?: string }[] | null;
    const key = Array.isArray(featureJoin) ? featureJoin[0]?.key : featureJoin?.key;
    if (key) usedByKey.set(key, Number(row.usage_count) || 0);
  }

  return {
    configured: billingConfigured(),
    provider: resolveBillingProvider(),
    current: {
      planKey: planRow?.key ?? null,
      planName: planRow?.name ?? null,
      status: (subRes.data?.status as SubscriptionStatus | undefined) ?? null,
      trialEndsAt: subRes.data?.trial_ends_at ?? null,
      endsAt: subRes.data?.ends_at ?? null,
    },
      hasStripeCustomer: customerRes.data?.provider === 'stripe',
    canCancel: canCancelOwnSubscription({
      planKey: planRow?.key ?? null,
      status: (subRes.data?.status as SubscriptionStatus | undefined) ?? null,
    }),
    plans,
    usage: METERED_FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      label: METERED_USAGE_LABELS[featureKey] ?? featureKey,
      used: usedByKey.get(featureKey) ?? 0,
      limit: getResolvedFeatureLimit(entitlements, featureKey),
    })),
  };
}

export async function startPlanCheckout(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await requirePermission('org:manage');
    const planKey = String(formData.get('planKey') ?? '');
    const interval = String(formData.get('interval') ?? 'monthly') === 'annual' ? 'annual' : 'monthly';
    if (!isPurchasablePlanKey(planKey)) {
      return { success: false, error: 'Ese plan no se puede comprar' };
    }

    const provider = resolveBillingProvider();
    if (!provider) {
      return {
        success: false,
        error: 'Los pagos todavía no están configurados. Pedile a Superadmin que asigne el plan.',
      };
    }

    const plans = await listPublicPlansCatalog();
    const plan = plans.find((item) => item.key === planKey);
    if (!plan || !canCheckoutPlan(plan.pricing) || !amountForInterval(plan.pricing, interval as BillingInterval)) {
      return { success: false, error: 'Este plan no tiene checkout público. Contactanos para Enterprise.' };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const checkoutParams = {
      organizationId: session.organizationId,
      organizationName: plan.name,
      customerEmail: user?.email ?? null,
      planKey,
      planName: plan.name,
      interval: interval as BillingInterval,
      pricing: plan.pricing,
    };

    const url =
      provider === 'stripe'
        ? await createStripeCheckoutUrl(checkoutParams)
        : await createMercadoPagoCheckoutUrl(checkoutParams);

    revalidatePath('/configuracion');
    return { success: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}

export async function startBillingPortal(): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await requirePermission('org:manage');
    if (resolveBillingProvider() !== 'stripe') {
      return { success: false, error: 'El portal de facturación está disponible con Stripe' };
    }
    const supabase = await createServerClient();
    const { data } = await supabase
      .from('billing_customers')
      .select('customer_id')
      .eq('organization_id', session.organizationId)
      .eq('provider', 'stripe')
      .maybeSingle();
    if (!data?.customer_id) {
      return { success: false, error: 'Todavía no hay un cliente de Stripe para esta clínica' };
    }
    const url = await createStripeBillingPortalUrl(data.customer_id);
    return { success: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelClinicSubscription(): Promise<ActionResult> {
  try {
    const state = await getPlanBillingState();
    if (!canCancelOwnSubscription(state.current)) {
      return {
        success: false,
        error:
          state.current.planKey === 'legacy'
            ? 'El plan legado no se cancela desde la clínica. Pedile a Superadmin.'
            : 'No hay una suscripción activa para cancelar',
      };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.rpc('billing_cancel_own_subscription');
    if (error) {
      if (error.message.includes('legacy')) {
        return { success: false, error: 'El plan legado no se cancela desde la clínica' };
      }
      if (error.message.includes('not authorized')) {
        throw new PermissionError();
      }
      return { success: false, error: 'No se pudo cancelar el plan' };
    }

    revalidatePath('/configuracion');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}
