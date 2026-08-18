import { NextResponse } from 'next/server';
import { parseAddonCheckoutReference, parseCheckoutReference } from '@sincvete/shared';
import {
  applyPaidAddon,
  applyPaidPlan,
  recordBillingEvent,
  upsertBillingCustomer,
} from '@/lib/billing/apply';
import { verifyMercadoPagoSignature } from '@/lib/billing/crypto';
import { fetchMercadoPagoPayment } from '@/lib/billing/mercadopago';

export const dynamic = 'force-dynamic';

function firstParam(value: string | null): string | null {
  return value && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  return handleMercadoPagoWebhook(request);
}

export async function GET(request: Request) {
  return handleMercadoPagoWebhook(request);
}

async function handleMercadoPagoWebhook(request: Request) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Mercado Pago no configurado' }, { status: 503 });
  }

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const type = String(body.type ?? body.topic ?? url.searchParams.get('topic') ?? '');
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : {};
  const paymentId =
    firstParam(String(data.id ?? '')) ||
    firstParam(url.searchParams.get('data.id')) ||
    firstParam(url.searchParams.get('id'));

  if (!paymentId || (type && !type.includes('payment'))) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret) {
    const signatureHeader = request.headers.get('x-signature');
    const parts = Object.fromEntries(
      (signatureHeader ?? '').split(',').map((item) => {
        const [key, ...rest] = item.split('=');
        return [key.trim(), rest.join('=')];
      })
    );
    const valid = verifyMercadoPagoSignature({
      dataId: paymentId,
      requestId: request.headers.get('x-request-id'),
      ts: parts.ts ?? null,
      headerSignature: parts.v1 ?? null,
      secret,
    });
    if (!valid) {
      return NextResponse.json({ error: 'firma inválida' }, { status: 400 });
    }
  }

  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ error: 'pago no encontrado' }, { status: 404 });
  }

  const recorded = await recordBillingEvent({
    provider: 'mercadopago',
    eventId: `payment:${payment.id}:${payment.status}`,
    eventType: type || 'payment',
    organizationId:
      parseAddonCheckoutReference(payment.externalReference)?.organizationId ??
      parseCheckoutReference(payment.externalReference)?.organizationId ??
      null,
    payload: { paymentId, status: payment.status, type },
  });
  if (recorded.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const addonRef = parseAddonCheckoutReference(payment.externalReference);
  const planRef = addonRef ? null : parseCheckoutReference(payment.externalReference);
  if (!addonRef && !planRef) {
    return NextResponse.json({ error: 'referencia inválida' }, { status: 400 });
  }

  try {
    if (addonRef) {
      await applyPaidAddon({
        organizationId: addonRef.organizationId,
        addonKey: addonRef.addonKey,
        provider: 'mercadopago',
        externalId: payment.id,
        interval: addonRef.interval,
      });
      if (payment.payerId) {
        await upsertBillingCustomer({
          organizationId: addonRef.organizationId,
          provider: 'mercadopago',
          customerId: payment.payerId,
          email: payment.payerEmail,
        });
      }
    } else if (planRef) {
      await applyPaidPlan({
        organizationId: planRef.organizationId,
        planKey: planRef.planKey,
        provider: 'mercadopago',
        externalId: payment.id,
        interval: planRef.interval,
      });
      if (payment.payerId) {
        await upsertBillingCustomer({
          organizationId: planRef.organizationId,
          provider: 'mercadopago',
          customerId: payment.payerId,
          email: payment.payerEmail,
        });
      }
    }
  } catch (error) {
    console.error('[mercadopago webhook]', error);
    return NextResponse.json({ error: 'no se pudo aplicar el pago' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
