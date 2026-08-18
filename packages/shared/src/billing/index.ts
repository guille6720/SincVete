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
