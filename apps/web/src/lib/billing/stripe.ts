import {
  encodeAddonCheckoutReference,
  encodeCheckoutReference,
  type BillingInterval,
  type PlanPricing,
} from '@sincvete/shared';
import { appUrl, formUrlEncoded } from '@/lib/billing/crypto';

export async function createStripeCheckoutUrl(params: {
  organizationId: string;
  organizationName: string;
  customerEmail: string | null;
  planKey: string;
  planName: string;
  interval: BillingInterval;
  pricing: PlanPricing;
  kind?: 'plan' | 'addon';
}): Promise<string> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Stripe no está configurado');

  const kind = params.kind ?? 'plan';
  const addonCheckout = kind === 'addon';
  const priceId = addonCheckout
    ? null
    : params.interval === 'annual'
      ? params.pricing.stripePriceIdAnnual
      : params.pricing.stripePriceIdMonthly;
  const success = `${appUrl()}/configuracion?tab=plan&checkout=success`;
  const cancel = `${appUrl()}/configuracion?tab=plan&checkout=cancel`;
  const reference = addonCheckout
    ? encodeAddonCheckoutReference({
        organizationId: params.organizationId,
        addonKey: params.planKey,
        interval: params.interval,
      })
    : encodeCheckoutReference({
        organizationId: params.organizationId,
        planKey: params.planKey,
        interval: params.interval,
      });

  const body: Record<string, string> = {
    mode: priceId ? 'subscription' : 'payment',
    success_url: success,
    cancel_url: cancel,
    client_reference_id: params.organizationId,
    'metadata[organization_id]': params.organizationId,
    'metadata[kind]': kind,
    'metadata[interval]': params.interval,
    'metadata[reference]': reference,
  };
  if (addonCheckout) {
    body['metadata[addon_key]'] = params.planKey;
  } else {
    body['metadata[plan_key]'] = params.planKey;
    body['subscription_data[metadata][organization_id]'] = params.organizationId;
    body['subscription_data[metadata][plan_key]'] = params.planKey;
  }
  if (params.customerEmail) body.customer_email = params.customerEmail;

  if (priceId) {
    body['line_items[0][price]'] = priceId;
    body['line_items[0][quantity]'] = '1';
  } else {
    const amount =
      params.interval === 'annual' ? params.pricing.annualAmount : params.pricing.monthlyAmount;
    if (!amount) throw new Error('Este ítem no tiene precio configurado para Stripe');
    body['line_items[0][price_data][currency]'] = params.pricing.currency.toLowerCase();
    body['line_items[0][price_data][product_data][name]'] = addonCheckout
      ? `SyncVete extra ${params.planName}`
      : `SyncVete ${params.planName}`;
    body['line_items[0][price_data][unit_amount]'] = String(amount * 100);
    body['line_items[0][quantity]'] = '1';
    body.mode = 'payment';
    delete body['subscription_data[metadata][organization_id]'];
    delete body['subscription_data[metadata][plan_key]'];
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formUrlEncoded(body),
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.url) {
    throw new Error(json.error?.message ?? 'No se pudo crear el checkout de Stripe');
  }
  void reference;
  return json.url;
}

export async function createStripeBillingPortalUrl(customerId: string): Promise<string> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Stripe no está configurado');
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formUrlEncoded({
      customer: customerId,
      return_url: `${appUrl()}/configuracion?tab=plan`,
    }),
  });
  const json = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !json.url) {
    throw new Error(json.error?.message ?? 'No se pudo abrir el portal de facturación');
  }
  return json.url;
}
