import {
  isPurchasablePlanKey,
  parseAddonCheckoutReference,
  parseCheckoutReference,
} from './pricing';

export type {
  BillingProvider,
  BillingInterval,
  PublicPlanCta,
  PlanPricing,
  PublicPlanCatalogItem,
  PublicAddonCatalogItem,
} from './pricing';

export {
  BILLING_PROVIDERS,
  BILLING_INTERVALS,
  FALLBACK_PUBLIC_PLANS,
  FALLBACK_PUBLIC_ADDONS,
  parsePlanPricing,
  formatArsAmount,
  amountForInterval,
  isPurchasablePlanKey,
  isPurchasableAddonKey,
  canCheckoutPlan,
  encodeCheckoutReference,
  parseCheckoutReference,
  encodeAddonCheckoutReference,
  parseAddonCheckoutReference,
  isBillingProvider,
} from './pricing';

export function isBillingEventAlreadyApplied(appliedAt: string | null | undefined): boolean {
  return Boolean(appliedAt);
}

/** Money already captured, then taken back. Rejected/cancelled checkouts are not this. */
export function shouldReversePaidGrant(status: string | null | undefined): boolean {
  const value = (status ?? '').toLowerCase();
  if (!value) return false;
  return (
    value === 'refunded' ||
    value === 'charged_back' ||
    value.includes('charge.refunded')
  );
}

function providerObjectId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

/** Stripe charge/session/invoice ids that can point at the same paid grant. */
export function collectProviderPaymentIds(
  source: Record<string, unknown> | null | undefined
): string[] {
  if (!source) return [];
  const keys = ['id', 'payment_intent', 'invoice', 'subscription', 'charge', 'checkout_session'];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const id = providerObjectId(source[key]);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Stripe `charge.refunded` also fires for partial refunds. Only a full take-back
 * should expire the grant. Mercado Pago `refunded` / `charged_back` are already full.
 */
export function isFullProviderRefund(params: {
  eventType?: string | null;
  status?: string | null;
  refunded?: boolean | null;
  amount?: number | null;
  amountRefunded?: number | null;
}): boolean {
  const eventType = (params.eventType ?? '').toLowerCase();
  const status = (params.status ?? '').toLowerCase();
  const token = `${eventType} ${status}`;

  if (status === 'refunded' || status === 'charged_back') return true;
  if (eventType === 'refunded' || eventType === 'charged_back') return true;
  if (token.includes('charged_back') || token.includes('chargeback')) return true;
  if (token.includes('dispute.closed')) return status === 'lost';

  const stripeChargeRefund =
    eventType === 'charge.refunded' ||
    eventType.includes('charge.refunded') ||
    status === 'charge.refunded';
  if (!stripeChargeRefund) return false;
  if (params.refunded === true) return true;
  const amount = params.amount;
  const refunded = params.amountRefunded;
  return (
    typeof amount === 'number' &&
    typeof refunded === 'number' &&
    Number.isFinite(amount) &&
    Number.isFinite(refunded) &&
    amount > 0 &&
    refunded >= amount
  );
}

export type RefundCheckoutTarget = {
  organizationId: string;
  kind: 'plan' | 'addon';
  targetKey: string;
};

export function refundCheckoutTargetFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallbackReference?: string | null
): RefundCheckoutTarget | null {
  const asText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const reference = asText(metadata?.reference) ?? fallbackReference ?? null;
  const addonRef = parseAddonCheckoutReference(reference);
  if (addonRef) {
    return {
      organizationId: addonRef.organizationId,
      kind: 'addon',
      targetKey: addonRef.addonKey,
    };
  }
  const planRef = parseCheckoutReference(reference);
  if (planRef) {
    return {
      organizationId: planRef.organizationId,
      kind: 'plan',
      targetKey: planRef.planKey,
    };
  }
  const organizationId = asText(metadata?.organization_id);
  const addonKey = asText(metadata?.addon_key);
  const planKey = asText(metadata?.plan_key);
  const kind = asText(metadata?.kind);
  if (organizationId && addonKey && (kind === 'addon' || !planKey)) {
    return { organizationId, kind: 'addon', targetKey: addonKey };
  }
  if (organizationId && planKey && isPurchasablePlanKey(planKey)) {
    return { organizationId, kind: 'plan', targetKey: planKey };
  }
  return null;
}

/** Provider statuses that mean the checkout will not complete. Pending/in_process stay locked. */
export function shouldReleaseCheckoutIntent(status: string | null | undefined): boolean {
  const value = (status ?? '').toLowerCase();
  if (!value) return false;
  return (
    value === 'rejected' ||
    value === 'cancelled' ||
    value === 'canceled' ||
    value === 'refunded' ||
    value === 'charged_back' ||
    value === 'expired' ||
    value === 'failed' ||
    value.includes('async_payment_failed') ||
    value.includes('checkout.session.expired')
  );
}

export type ClinicCheckoutReturnState =
  | 'none'
  | 'cancelled'
  | 'waiting_success'
  | 'waiting_pending'
  | 'cleared';

/**
 * Return-URL banners must follow the open checkout, not the query string alone.
 * Superadmin skip / apply / expire clear intents while ?checkout=success can still be in the URL.
 */
export function resolveClinicCheckoutReturn(params: {
  query?: string | null;
  openIntentCount: number;
}): ClinicCheckoutReturnState {
  const query = (params.query ?? '').trim();
  if (query === 'cancel') return 'cancelled';
  if (query !== 'success' && query !== 'pending') return 'none';
  if (params.openIntentCount > 0) {
    return query === 'success' ? 'waiting_success' : 'waiting_pending';
  }
  return 'cleared';
}

export type StoredStripeBillingEvent = {
  id?: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

/** Stored Stripe webhook body. Missing `type` cannot be replayed. */
export function stripeEventFromBillingPayload(payload: unknown): StoredStripeBillingEvent | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const type = typeof row.type === 'string' && row.type.trim() ? row.type.trim() : '';
  if (!type) return null;
  const nested =
    row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : null;
  const object =
    nested?.object && typeof nested.object === 'object' && !Array.isArray(nested.object)
      ? (nested.object as Record<string, unknown>)
      : {};
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    type,
    data: { object },
  };
}

/** Mercado Pago stores `{ paymentId, status, type }`, not the payment body. */
export function mercadoPagoPaymentIdFromBillingPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const row = payload as Record<string, unknown>;
  const paymentId = row.paymentId ?? row.payment_id;
  if (typeof paymentId === 'string' && paymentId.trim()) return paymentId.trim();
  if (typeof paymentId === 'number' && Number.isFinite(paymentId)) return String(paymentId);
  return null;
}

export function mercadoPagoTopicFromBillingPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'payment';
  const row = payload as Record<string, unknown>;
  return typeof row.type === 'string' && row.type.trim() ? row.type.trim() : 'payment';
}

export function formatBillingEventLabel(eventType: string | null | undefined): string {
  const type = (eventType ?? '').toLowerCase();
  if (!type) return 'Evento de pago';
  if (type.includes('completed') || type.includes('approved') || type === 'payment.created' || type === 'invoice.paid' || type.includes('payment_succeeded')) {
    return 'Pago acreditado';
  }
  if (type.includes('refund') || type.includes('charged_back') || type.includes('chargeback') || type.includes('dispute')) {
    return 'Reembolso';
  }
  if (type.includes('failed') || type.includes('rejected') || type.includes('payment_failed')) {
    return 'Pago rechazado';
  }
  if (type.includes('past_due') || type.includes('action_required')) {
    return 'Pago pendiente';
  }
  if (type.includes('canceled') || type.includes('cancelled')) {
    return 'Cancelación';
  }
  return eventType ?? 'Evento de pago';
}
