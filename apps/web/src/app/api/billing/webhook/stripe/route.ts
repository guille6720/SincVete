import { NextResponse } from 'next/server';
import { parseCheckoutReference } from '@sincvete/shared';
import {
  applyPaidPlan,
  recordBillingEvent,
  setPaidSubscriptionStatus,
  upsertBillingCustomer,
} from '@/lib/billing/apply';
import { verifyStripeSignature } from '@/lib/billing/crypto';

export const dynamic = 'force-dynamic';

type StripeObject = {
  id?: string;
  object?: string;
  client_reference_id?: string;
  customer?: string;
  customer_email?: string;
  metadata?: Record<string, string>;
  status?: string;
  payment_status?: string;
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe webhook no configurado' }, { status: 503 });
  }

  const payload = await request.text();
  const valid = verifyStripeSignature({
    payload,
    header: request.headers.get('stripe-signature'),
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: 'firma inválida' }, { status: 400 });
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: StripeObject };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }
  const object = event.data?.object ?? {};
  const eventId = event.id ?? object.id;
  if (!eventId || !event.type) {
    return NextResponse.json({ error: 'evento inválido' }, { status: 400 });
  }

  const metadata = object.metadata ?? {};
  const reference = parseCheckoutReference(
    metadata.reference ??
      (metadata.organization_id && metadata.plan_key
        ? `${metadata.organization_id}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
        : object.client_reference_id && metadata.plan_key
          ? `${object.client_reference_id}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
          : null)
  );
  const organizationId = reference?.organizationId ?? metadata.organization_id ?? object.client_reference_id ?? null;

  const recorded = await recordBillingEvent({
    provider: 'stripe',
    eventId,
    eventType: event.type,
    organizationId,
    payload: event as unknown as Record<string, unknown>,
  });
  if (recorded.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      if (!reference) {
        return NextResponse.json({ error: 'referencia inválida' }, { status: 400 });
      }
      const paid = object.status === 'complete' || object.payment_status === 'paid';
      if (event.type === 'checkout.session.completed' && !paid) {
        return NextResponse.json({ ok: true, skipped: true });
      }
      await applyPaidPlan({
        organizationId: reference.organizationId,
        planKey: reference.planKey,
        provider: 'stripe',
        externalId: object.id ?? eventId,
        interval: reference.interval,
      });
      if (object.customer) {
        await upsertBillingCustomer({
          organizationId: reference.organizationId,
          provider: 'stripe',
          customerId: object.customer,
          email: object.customer_email ?? null,
        });
      }
    } else if (event.type === 'customer.subscription.updated' && organizationId) {
      const status = object.status;
      if (status === 'past_due' || status === 'unpaid') {
        await setPaidSubscriptionStatus({
          organizationId,
          status: 'past_due',
          provider: 'stripe',
          externalId: object.id,
        });
      } else if (status === 'active') {
        await setPaidSubscriptionStatus({
          organizationId,
          status: 'active',
          provider: 'stripe',
          externalId: object.id,
        });
      } else if (status === 'canceled') {
        await setPaidSubscriptionStatus({
          organizationId,
          status: 'cancelled',
          provider: 'stripe',
          externalId: object.id,
        });
      }
    } else if (event.type === 'customer.subscription.deleted' && organizationId) {
      await setPaidSubscriptionStatus({
        organizationId,
        status: 'cancelled',
        provider: 'stripe',
        externalId: object.id,
      });
    }
  } catch (error) {
    console.error('[stripe webhook]', error);
    return NextResponse.json({ error: 'no se pudo aplicar el evento' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
