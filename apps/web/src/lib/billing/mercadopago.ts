import {
  encodeCheckoutReference,
  amountForInterval,
  type BillingInterval,
  type PlanPricing,
} from '@sincvete/shared';
import { appUrl } from '@/lib/billing/crypto';

export async function createMercadoPagoCheckoutUrl(params: {
  organizationId: string;
  organizationName: string;
  customerEmail: string | null;
  planKey: string;
  planName: string;
  interval: BillingInterval;
  pricing: PlanPricing;
}): Promise<string> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Mercado Pago no está configurado');

  const amount = amountForInterval(params.pricing, params.interval);
  if (!amount) throw new Error('Este plan no tiene precio configurado');

  const reference = encodeCheckoutReference({
    organizationId: params.organizationId,
    planKey: params.planKey,
    interval: params.interval,
  });
  const back = `${appUrl()}/configuracion?tab=plan`;

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          title: `SyncVete ${params.planName} (${params.interval === 'annual' ? 'anual' : 'mensual'})`,
          quantity: 1,
          currency_id: params.pricing.currency,
          unit_price: amount,
        },
      ],
      payer: params.customerEmail ? { email: params.customerEmail } : undefined,
      metadata: {
        organization_id: params.organizationId,
        plan_key: params.planKey,
        interval: params.interval,
      },
      external_reference: reference,
      back_urls: {
        success: `${back}&checkout=success`,
        failure: `${back}&checkout=cancel`,
        pending: `${back}&checkout=pending`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl()}/api/billing/webhook/mercadopago`,
    }),
  });

  const json = (await response.json()) as {
    init_point?: string;
    sandbox_init_point?: string;
    message?: string;
  };
  const url = json.init_point || json.sandbox_init_point;
  if (!response.ok || !url) {
    throw new Error(json.message ?? 'No se pudo crear el checkout de Mercado Pago');
  }
  return url;
}

export async function fetchMercadoPagoPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  externalReference: string | null;
  payerEmail: string | null;
  payerId: string | null;
} | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    id?: number | string;
    status?: string;
    external_reference?: string;
    payer?: { email?: string; id?: number | string };
  };
  return {
    id: String(json.id ?? paymentId),
    status: json.status ?? '',
    externalReference: json.external_reference ?? null,
    payerEmail: json.payer?.email ?? null,
    payerId: json.payer?.id != null ? String(json.payer.id) : null,
  };
}
