'use server';

import { revalidatePath } from 'next/cache';
import {
  ADDON_PRIMARY_FEATURE,
  amountForInterval,
  canCheckoutPlan,
  canCheckoutAddonOffer,
  canCancelOwnAddon,
  canCancelOwnSubscription,
  canUseResolvedFeature,
  isAddonKey,
  isPeriodEndingSoon,
  isPurchasableAddonKey,
  isPurchasablePlanKey,
  isSubscriptionPeriodOpen,
  resolveAddonOfferState,
  type ActionResult,
  type AddonOfferState,
  type BillingInterval,
  type MeteredUsageMeter,
  type PublicAddonCatalogItem,
  type PublicPlanCatalogItem,
  type SubscriptionStatus,
} from '@sincvete/shared';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase/server';
import { billingConfigured, resolveBillingProvider } from '@/lib/billing/crypto';
import { listPublicAddonsCatalog, listPublicPlansCatalog } from '@/lib/billing/catalog';
import { createMercadoPagoCheckoutUrl } from '@/lib/billing/mercadopago';
import { createStripeBillingPortalUrl, createStripeCheckoutUrl } from '@/lib/billing/stripe';
import { getMeteredUsageMeters, getOrganizationEntitlements } from '@/lib/entitlements';

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

export type PlanBillingEvent = {
  id: string;
  provider: string;
  eventType: string | null;
  processedAt: string;
};

export type ClinicAddonOffer = PublicAddonCatalogItem & {
  offerState: AddonOfferState;
  endsAt: string | null;
  canCancel: boolean;
  endingSoon: boolean;
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
  usage: MeteredUsageMeter[];
  events: PlanBillingEvent[];
  addonOffers: ClinicAddonOffer[];
};

export async function getPlanBillingState(): Promise<PlanBillingState> {
  const session = await requirePermission('org:manage');
  const supabase = await createServerClient();
  const [plans, addonCatalog, subRes, customerRes, usage, eventsRes, addonsRes, entitlements] =
    await Promise.all([
    listPublicPlansCatalog(),
    listPublicAddonsCatalog(),
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
    getMeteredUsageMeters(session.organizationId),
    supabase.rpc('list_own_billing_events', { p_limit: 12 }),
    supabase.rpc('list_own_addons'),
    getOrganizationEntitlements(session.organizationId),
  ]);

  const planJoin = subRes.data?.plans as { key?: string; name?: string } | { key?: string; name?: string }[] | null;
  const planRow = Array.isArray(planJoin) ? planJoin[0] : planJoin;
  const status = (subRes.data?.status as SubscriptionStatus | undefined) ?? null;
  const subscriptionOpen = isSubscriptionPeriodOpen({
    status,
    trialEndsAt: subRes.data?.trial_ends_at ?? null,
    endsAt: subRes.data?.ends_at ?? null,
  });
  const owned = new Map(
    (addonsRes.data ?? []).map((row) => [
      row.addon_key,
      { endsAt: row.ends_at, status: row.status as SubscriptionStatus },
    ])
  );

  return {
    configured: billingConfigured(),
    provider: resolveBillingProvider(),
    current: {
      planKey: planRow?.key ?? null,
      planName: planRow?.name ?? null,
      status,
      trialEndsAt: subRes.data?.trial_ends_at ?? null,
      endsAt: subRes.data?.ends_at ?? null,
    },
    hasStripeCustomer: customerRes.data?.provider === 'stripe',
    canCancel: canCancelOwnSubscription({
      planKey: planRow?.key ?? null,
      status,
    }),
    plans,
    usage,
    events: (eventsRes.data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      eventType: row.event_type,
      processedAt: row.processed_at,
    })),
    addonOffers: addonCatalog.map((item) => {
      const ownedRow = owned.get(item.key);
      const primary = isAddonKey(item.key) ? ADDON_PRIMARY_FEATURE[item.key] : null;
      const offerState = resolveAddonOfferState({
        planKey: planRow?.key ?? null,
        subscriptionOpen,
        addonActive: Boolean(ownedRow),
        primaryFeatureEnabled: primary ? canUseResolvedFeature(entitlements, primary) : false,
      });
      return {
        ...item,
        offerState,
        endsAt: ownedRow?.endsAt ?? null,
        canCancel: offerState === 'active' && canCancelOwnAddon({ status: ownedRow?.status }),
        endingSoon: isPeriodEndingSoon({ endsAt: ownedRow?.endsAt ?? null }),
      };
    }),
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

export async function startAddonCheckout(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const state = await getPlanBillingState();
    const addonKey = String(formData.get('addonKey') ?? '');
    const interval = String(formData.get('interval') ?? 'monthly') === 'annual' ? 'annual' : 'monthly';
    if (!isPurchasableAddonKey(addonKey)) {
      return { success: false, error: 'Ese extra no se puede comprar' };
    }
    const offer = state.addonOffers.find((item) => item.key === addonKey);
    if (!offer) {
      return { success: false, error: 'Ese extra no está disponible' };
    }
    if (offer.offerState === 'included') {
      return { success: false, error: 'Ese extra ya está incluido en tu plan' };
    }
    if (!canCheckoutAddonOffer(offer.offerState)) {
      return { success: false, error: 'Elegí un plan comercial antes de comprar extras' };
    }
    if (!canCheckoutPlan(offer.pricing) || !amountForInterval(offer.pricing, interval as BillingInterval)) {
      return { success: false, error: 'Este extra no tiene checkout público' };
    }

    const provider = resolveBillingProvider();
    if (!provider) {
      return {
        success: false,
        error: 'Los pagos todavía no están configurados. Pedile a Superadmin que otorgue el extra.',
      };
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const checkoutParams = {
      organizationId: (await requirePermission('org:manage')).organizationId,
      organizationName: offer.name,
      customerEmail: user?.email ?? null,
      planKey: addonKey,
      planName: offer.name,
      interval: interval as BillingInterval,
      pricing: offer.pricing,
      kind: 'addon' as const,
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

export async function cancelClinicAddon(formData: FormData): Promise<ActionResult> {
  try {
    const state = await getPlanBillingState();
    const addonKey = String(formData.get('addonKey') ?? '');
    const offer = state.addonOffers.find((item) => item.key === addonKey);
    if (!offer?.canCancel) {
      return { success: false, error: 'No hay un extra activo para cancelar' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.rpc('billing_cancel_own_addon', { p_addon_key: addonKey });
    if (error) {
      if (error.message.includes('not authorized')) {
        throw new PermissionError();
      }
      return { success: false, error: 'No se pudo cancelar el extra' };
    }

    revalidatePath('/configuracion');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}
