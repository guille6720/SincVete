import {
  collectProviderPaymentIds,
  isFullProviderRefund,
  mercadoPagoPaymentIdFromBillingPayload,
  parseAddonCheckoutReference,
  parseCheckoutReference,
  refundCheckoutTargetFromMetadata,
  shouldReleaseCheckoutIntent,
  shouldReversePaidGrant,
  stripeCheckoutReferenceFromObject,
  stripeEventFromBillingPayload,
  type StoredStripeBillingEvent,
} from '@sincvete/shared';
import {
  applyPaidAddon,
  applyPaidPlan,
  attachPaidGrantProviderIds,
  extendPaidPlanPeriod,
  findOrganizationIdByStripeCustomer,
  finishBillingEvent,
  lookupPaidGrantFromProviderIds,
  releaseCheckoutIntents,
  reversePaidGrant,
  setPaidSubscriptionStatus,
  upsertBillingCustomer,
} from '@/lib/billing/apply';
import { fetchMercadoPagoPayment } from '@/lib/billing/mercadopago';

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
  refunded?: boolean;
  amount?: number;
  amount_refunded?: number;
  payment_intent?: string | { id?: string };
  invoice?: string | { id?: string };
  charge?: string | { id?: string };
  subscription?: string | { id?: string };
};

function stripeId(value: string | { id?: string } | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}

function asStripeObject(value: Record<string, unknown> | undefined): StripeObject {
  return (value ?? {}) as StripeObject;
}

function asMetadata(value: Record<string, string> | undefined): Record<string, string> {
  return value ?? {};
}

export async function dispatchStripeBillingEvent(event: StoredStripeBillingEvent): Promise<void> {
  const object = asStripeObject(event.data?.object);
  const eventId = event.id ?? object.id;
  if (!eventId || !event.type) {
    throw new Error('evento inválido');
  }

    const metadata = asMetadata(object.metadata);
  const rawReference = stripeCheckoutReferenceFromObject({
    metadata,
    clientReferenceId: object.client_reference_id ?? null,
  });
  const addonRef = parseAddonCheckoutReference(rawReference);
  const planRef = addonRef ? null : parseCheckoutReference(rawReference);
  const organizationId =
    addonRef?.organizationId ??
    planRef?.organizationId ??
    metadata.organization_id ??
    object.client_reference_id ??
    null;

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
        await attachPaidGrantProviderIds({
          organizationId: addonRef.organizationId,
          kind: 'addon',
          targetKey: addonRef.addonKey,
          ids: {
            checkoutSessionId: object.id,
            paymentIntentId: stripeId(object.payment_intent),
            invoiceId: stripeId(object.invoice),
            stripeSubscriptionId: stripeId(object.subscription),
          },
        });
      } else if (planRef) {
        await applyPaidPlan({
          organizationId: planRef.organizationId,
          planKey: planRef.planKey,
          provider: 'stripe',
          externalId: object.id ?? eventId,
          interval: planRef.interval,
        });
        await attachPaidGrantProviderIds({
          organizationId: planRef.organizationId,
          kind: 'plan',
          targetKey: planRef.planKey,
          ids: {
            checkoutSessionId: object.id,
            paymentIntentId: stripeId(object.payment_intent),
            invoiceId: stripeId(object.invoice),
            stripeSubscriptionId: stripeId(object.subscription),
          },
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
    return;
  }

  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    if (addonRef) {
      await releaseCheckoutIntents({
        organizationId: addonRef.organizationId,
        kind: 'addon',
        targetKey: addonRef.addonKey,
      });
    } else if (planRef) {
      await releaseCheckoutIntents({
        organizationId: planRef.organizationId,
        kind: 'plan',
        targetKey: planRef.planKey,
      });
    } else if (organizationId) {
      await releaseCheckoutIntents({ organizationId });
    }
    return;
  }

  if (
    event.type === 'charge.refunded' ||
    (event.type === 'charge.dispute.closed' && object.status === 'lost') ||
    shouldReversePaidGrant(event.type)
  ) {
    const fullRefund = isFullProviderRefund({
      eventType: event.type,
      status: object.status,
      refunded: object.refunded,
      amount: object.amount,
      amountRefunded: object.amount_refunded,
    });
    if (!fullRefund) return;

    const ids = collectProviderPaymentIds(object as Record<string, unknown>);
    const metadataTarget = refundCheckoutTargetFromMetadata(
      metadata,
      object.client_reference_id ?? null
    );
    let orgId =
      organizationId ??
      metadataTarget?.organizationId ??
      (await findOrganizationIdByStripeCustomer(stripeId(object.customer)));
    let kind: 'plan' | 'addon' | null =
      addonRef ? 'addon' : planRef ? 'plan' : metadataTarget?.kind ?? null;
    let targetKey =
      addonRef?.addonKey ??
      planRef?.planKey ??
      metadataTarget?.targetKey ??
      metadata.plan_key ??
      metadata.addon_key ??
      null;

    if (!orgId || !kind) {
      const looked = await lookupPaidGrantFromProviderIds({ provider: 'stripe', ids });
      if (looked) {
        orgId = orgId ?? looked.organizationId;
        kind = kind ?? looked.kind;
        targetKey = targetKey ?? looked.targetKey;
      }
    }

    if (orgId && kind) {
      await reversePaidGrant({
        organizationId: orgId,
        kind,
        targetKey,
        provider: 'stripe',
        externalId: object.id ?? eventId,
        providerIds: ids,
        reason: event.type,
      });
    }
    return;
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    const reason = object.billing_reason ?? '';
    if (reason === 'subscription_cycle' || reason === 'subscription_update') {
      const extended = await extendPaidPlanPeriod({
        organizationId,
        stripeCustomerId: stripeId(object.customer),
        interval: metadata.interval === 'annual' ? 'annual' : 'monthly',
        provider: 'stripe',
        externalId: object.id ?? eventId,
      });
      if (extended && organizationId) {
        await attachPaidGrantProviderIds({
          organizationId,
          kind: 'plan',
          targetKey: metadata.plan_key ?? '',
          ids: {
            invoiceId: object.id,
            paymentIntentId: stripeId(object.payment_intent),
            chargeId: stripeId(object.charge),
            stripeSubscriptionId: stripeId(object.subscription),
          },
        });
      }
    }
    return;
  }

  if (event.type === 'invoice.payment_failed') {
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
    return;
  }

  if (event.type === 'customer.subscription.updated' && organizationId) {
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
    return;
  }

  if (event.type === 'customer.subscription.deleted' && organizationId) {
    await setPaidSubscriptionStatus({
      organizationId,
      status: 'cancelled',
      provider: 'stripe',
      externalId: object.id,
    });
  }
}

export async function dispatchMercadoPagoPayment(params: {
  payment: {
    id: string;
    status: string;
    externalReference: string | null;
    payerEmail: string | null;
    payerId: string | null;
  };
}): Promise<void> {
  const addonRef = parseAddonCheckoutReference(params.payment.externalReference);
  const planRef = addonRef ? null : parseCheckoutReference(params.payment.externalReference);
  const organizationId = addonRef?.organizationId ?? planRef?.organizationId ?? null;

  if (params.payment.status !== 'approved') {
    if (shouldReversePaidGrant(params.payment.status) && organizationId && (addonRef || planRef)) {
      await reversePaidGrant({
        organizationId,
        kind: addonRef ? 'addon' : 'plan',
        targetKey: addonRef?.addonKey ?? planRef?.planKey ?? null,
        provider: 'mercadopago',
        externalId: params.payment.id,
        providerIds: [params.payment.id],
        reason: params.payment.status,
      });
    }
    if (shouldReleaseCheckoutIntent(params.payment.status) && organizationId) {
      await releaseCheckoutIntents({
        organizationId,
        kind: addonRef ? 'addon' : planRef ? 'plan' : null,
        targetKey: addonRef?.addonKey ?? planRef?.planKey ?? null,
      });
    }
    return;
  }

  if (!addonRef && !planRef) {
    throw new Error('referencia inválida');
  }

  if (addonRef) {
    await applyPaidAddon({
      organizationId: addonRef.organizationId,
      addonKey: addonRef.addonKey,
      provider: 'mercadopago',
      externalId: params.payment.id,
      interval: addonRef.interval,
    });
    if (params.payment.payerId) {
      await upsertBillingCustomer({
        organizationId: addonRef.organizationId,
        provider: 'mercadopago',
        customerId: params.payment.payerId,
        email: params.payment.payerEmail,
      });
    }
    return;
  }

  await applyPaidPlan({
    organizationId: planRef!.organizationId,
    planKey: planRef!.planKey,
    provider: 'mercadopago',
    externalId: params.payment.id,
    interval: planRef!.interval,
  });
  if (params.payment.payerId) {
    await upsertBillingCustomer({
      organizationId: planRef!.organizationId,
      provider: 'mercadopago',
      customerId: params.payment.payerId,
      email: params.payment.payerEmail,
    });
  }
}

/** Replay a claimed, unfinished billing row. Finish stays here so apply failures remain pending. */
export async function replayClaimedBillingEvent(params: {
  eventRowId: string;
  provider: string;
  payload: unknown;
}): Promise<void> {
  if (params.provider === 'stripe') {
    const event = stripeEventFromBillingPayload(params.payload);
    if (!event) throw new Error('payload de Stripe inválido');
    await dispatchStripeBillingEvent(event);
  } else if (params.provider === 'mercadopago') {
    const paymentId = mercadoPagoPaymentIdFromBillingPayload(params.payload);
    if (!paymentId) throw new Error('payload de Mercado Pago inválido');
    const payment = await fetchMercadoPagoPayment(paymentId);
    if (!payment) throw new Error('pago no encontrado');
    await dispatchMercadoPagoPayment({ payment });
  } else {
    throw new Error('proveedor desconocido');
  }
  await finishBillingEvent(params.eventRowId);
}
