import { NextResponse } from 'next/server';
import { parseAddonCheckoutReference, parseCheckoutReference } from '@sincvete/shared';
import { claimBillingEvent, finishBillingEvent } from '@/lib/billing/apply';
import { dispatchStripeBillingEvent } from '@/lib/billing/dispatch';
import { verifyStripeSignature } from '@/lib/billing/crypto';

export const dynamic = 'force-dynamic';

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
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }
  const object = event.data?.object ?? {};
  const eventId = event.id ?? (typeof object.id === 'string' ? object.id : undefined);
  if (!eventId || !event.type) {
    return NextResponse.json({ error: 'evento inválido' }, { status: 400 });
  }

  const metadata =
    object.metadata && typeof object.metadata === 'object' && !Array.isArray(object.metadata)
      ? (object.metadata as Record<string, string>)
      : {};
  const clientReference =
    typeof object.client_reference_id === 'string' ? object.client_reference_id : null;
  const rawReference =
    metadata.reference ??
    (metadata.kind === 'addon' && metadata.organization_id && metadata.addon_key
      ? `${metadata.organization_id}:addon:${metadata.addon_key}:${metadata.interval ?? 'monthly'}`
      : metadata.organization_id && metadata.plan_key
        ? `${metadata.organization_id}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
        : clientReference && metadata.plan_key
          ? `${clientReference}:${metadata.plan_key}:${metadata.interval ?? 'monthly'}`
          : null);
  const addonRef = parseAddonCheckoutReference(rawReference);
  const planRef = addonRef ? null : parseCheckoutReference(rawReference);
  const organizationId =
    addonRef?.organizationId ??
    planRef?.organizationId ??
    metadata.organization_id ??
    clientReference;

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
    await dispatchStripeBillingEvent({
      id: event.id,
      type: event.type,
      data: event.data,
    });
    await finishBillingEvent(recorded.id);
  } catch (error) {
    console.error('[stripe webhook]', error);
    return NextResponse.json({ error: 'no se pudo aplicar el evento' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
