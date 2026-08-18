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

export function formatBillingEventLabel(eventType: string | null | undefined): string {
  const type = (eventType ?? '').toLowerCase();
  if (!type) return 'Evento de pago';
  if (type.includes('completed') || type.includes('approved') || type === 'payment.created' || type === 'invoice.paid' || type.includes('payment_succeeded')) {
    return 'Pago acreditado';
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
