import { NextResponse } from 'next/server';
import { parseAddonCheckoutReference, parseCheckoutReference } from '@sincvete/shared';
import {
  applyPaidAddon,
  applyPaidPlan,
  claimBillingEvent,
  extendPaidPlanPeriod,
  findOrganizationIdByStripeCustomer,
  finishBillingEvent,
  setPaidSubscriptionStatus,
  upsertBillingCustomer,
} from '@/lib/billing/apply';
import { verifyStripeSignature } from '@/lib/billing/crypto';

export const dynamic = 'force-dynamic';

type StripeObject = {
  id?: string;
  object?: string;
  client_reference_id?: string;
  customer?: string | { id?: string };
  customer_email?: string;
  metadata?: Record<string, string>;
  status?: string;
  payment_status?: string;
  billing_reason?: string;
  subscription?: string | { id?: string };
};

function stripeId(value: string | { id?: string } | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}

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
  const rawReference =
    metadata.reference ??
    (metadata.kind === 'addon' && metadata.organization_id && metadata.addon_key
      ? `${metadata.organization_id}:addon:${metadata.addon_key}:${metadata.interval ?? 'monthly'}`
      : metadata.organization_id && metadata.plan_key
        ? `${metadata.organization_id}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
        : object.client_reference_id && metadata.plan_key
          ? `${object.client_reference_id}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
          : null);
  const addonRef = parseAddonCheckoutReference(rawReference);
  const planRef = addonRef ? null : parseCheckoutReference(rawReference);
  const organizationId =
    addonRef?.organizationId ??
    planRef?.organizationId ??
    metadata.organization_id ??
    object.client_reference_id ??
    null;

  const recorded = await claimBillingEvent({
    provider: 'stripe',
    eventId,
    eventType: event.type,
    organizationId,
    payload: event as unknown as Record<string, unknown>,
  });
  if (recorded.alreadyApplied) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      if (!addonRef && !planRef) {
        throw new Error('referencia inválida');
      }
      const paid = object.status === 'complete' || object.payment_status === 'paid';
      if (event.type !== 'checkout.session.completed' || paid) {
        if (addonRef) {
          await applyPaidAddon({
            organizationId: addonRef.organizationId,
            addonKey: addonRef.addonKey,
            provider: 'stripe',
            externalId: object.id ?? eventId,
            interval: addonRef.interval,
          });
        } else if (planRef) {
          await applyPaidPlan({
            organizationId: planRef.organizationId,
            planKey: planRef.planKey,
            provider: 'stripe',
            externalId: object.id ?? eventId,
            interval: planRef.interval,
          });
        }
        const customerId = stripeId(object.customer);
        if (customerId) {
          await upsertBillingCustomer({
            organizationId: (addonRef ?? planRef)!.organizationId,
            provider: 'stripe',
            customerId,
            email: object.customer_email ?? null,
          });
        }
      }
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const reason = object.billing_reason ?? '';
      if (reason === 'subscription_cycle' || reason === 'subscription_update') {
        await extendPaidPlanPeriod({
          organizationId,
          stripeCustomerId: stripeId(object.customer),
          interval: metadata.interval === 'annual' ? 'annual' : 'monthly',
          provider: 'stripe',
          externalId: object.id ?? eventId,
        });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const orgId =
        organizationId ?? (await findOrganizationIdByStripeCustomer(stripeId(object.customer)));
      if (orgId) {
        await setPaidSubscriptionStatus({
          organizationId: orgId,
          status: 'past_due',
          provider: 'stripe',
          externalId: object.id ?? eventId,
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
    await finishBillingEvent(recorded.id);
  } catch (error) {
    console.error('[stripe webhook]', error);
    return NextResponse.json({ error: 'no se pudo aplicar el evento' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
