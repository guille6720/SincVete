import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PLAN_KEYS,
  FALLBACK_PUBLIC_PLANS,
  amountForInterval,
  canCheckoutPlan,
  encodeCheckoutReference,
  isPurchasablePlanKey,
  parseCheckoutReference,
  encodeAddonCheckoutReference,
  parseAddonCheckoutReference,
  parsePlanPricing,
  formatBillingEventLabel,
  isBillingEventAlreadyApplied,
  shouldReleaseCheckoutIntent,
  shouldReversePaidGrant,
} from '../index';

describe('plan pricing catalog', () => {
  it('does not offer legacy or trial at checkout', () => {
    expect(isPurchasablePlanKey(COMMERCIAL_PLAN_KEYS.BASIC)).toBe(true);
    expect(isPurchasablePlanKey(COMMERCIAL_PLAN_KEYS.LEGACY)).toBe(false);
    expect(isPurchasablePlanKey(COMMERCIAL_PLAN_KEYS.TRIAL)).toBe(false);
    expect(FALLBACK_PUBLIC_PLANS.every((plan) => isPurchasablePlanKey(plan.key))).toBe(true);
  });

  it('parses pricing metadata and treats contact plans as not checkoutable', () => {
    const parsed = parsePlanPricing({
      currency: 'ARS',
      monthly_amount: 39900,
      annual_amount: '399000',
      recommended: true,
      cta: 'checkout',
      highlights: ['Facturación'],
    });
    expect(parsed.monthlyAmount).toBe(39900);
    expect(parsed.annualAmount).toBe(399000);
    expect(amountForInterval(parsed, 'annual')).toBe(399000);
    expect(canCheckoutPlan(parsed)).toBe(true);

    const enterprise = parsePlanPricing({ cta: 'contact', monthly_amount: null });
    expect(canCheckoutPlan(enterprise)).toBe(false);
  });

  it('encodes and parses checkout references without accepting legacy', () => {
    const encoded = encodeCheckoutReference({
      organizationId: '11111111-1111-1111-1111-111111111111',
      planKey: COMMERCIAL_PLAN_KEYS.PRO,
      interval: 'annual',
    });
    expect(parseCheckoutReference(encoded)).toEqual({
      organizationId: '11111111-1111-1111-1111-111111111111',
      planKey: COMMERCIAL_PLAN_KEYS.PRO,
      interval: 'annual',
    });
    expect(
      parseCheckoutReference(`org:${COMMERCIAL_PLAN_KEYS.LEGACY}:monthly`)
    ).toBeNull();
  });

  it('encodes add-on checkout refs without colliding with plan refs', () => {
    const encoded = encodeAddonCheckoutReference({
      organizationId: '11111111-1111-1111-1111-111111111111',
      addonKey: 'addon.ai',
      interval: 'monthly',
    });
    expect(parseCheckoutReference(encoded)).toBeNull();
    expect(parseAddonCheckoutReference(encoded)).toEqual({
      organizationId: '11111111-1111-1111-1111-111111111111',
      addonKey: 'addon.ai',
      interval: 'monthly',
    });
    expect(
      parseAddonCheckoutReference(
        '11111111-1111-1111-1111-111111111111:pro:monthly'
      )
    ).toBeNull();
  });

  it('labels provider webhook types for clinic history', () => {
    expect(formatBillingEventLabel('invoice.paid')).toBe('Pago acreditado');
    expect(formatBillingEventLabel('invoice.payment_failed')).toBe('Pago rechazado');
    expect(formatBillingEventLabel('customer.subscription.canceled')).toBe('Cancelación');
    expect(formatBillingEventLabel('charge.refunded')).toBe('Reembolso');
    expect(formatBillingEventLabel('charged_back')).toBe('Reembolso');
  });

  it('replays webhook apply only while applied_at is empty', () => {
    expect(isBillingEventAlreadyApplied(null)).toBe(false);
    expect(isBillingEventAlreadyApplied(undefined)).toBe(false);
    expect(isBillingEventAlreadyApplied('2026-08-18T12:00:00.000Z')).toBe(true);
  });

  it('releases checkout lock on rejected or expired payments, not pending', () => {
    expect(shouldReleaseCheckoutIntent('rejected')).toBe(true);
    expect(shouldReleaseCheckoutIntent('cancelled')).toBe(true);
    expect(shouldReleaseCheckoutIntent('refunded')).toBe(true);
    expect(shouldReleaseCheckoutIntent('charged_back')).toBe(true);
    expect(shouldReleaseCheckoutIntent('checkout.session.expired')).toBe(true);
    expect(shouldReleaseCheckoutIntent('checkout.session.async_payment_failed')).toBe(true);
    expect(shouldReleaseCheckoutIntent('pending')).toBe(false);
    expect(shouldReleaseCheckoutIntent('in_process')).toBe(false);
    expect(shouldReleaseCheckoutIntent('approved')).toBe(false);
  });

  it('reverses an applied grant only on refund or chargeback', () => {
    expect(shouldReversePaidGrant('refunded')).toBe(true);
    expect(shouldReversePaidGrant('charged_back')).toBe(true);
    expect(shouldReversePaidGrant('charge.refunded')).toBe(true);
    expect(shouldReversePaidGrant('rejected')).toBe(false);
    expect(shouldReversePaidGrant('cancelled')).toBe(false);
    expect(shouldReversePaidGrant('pending')).toBe(false);
    expect(shouldReversePaidGrant('approved')).toBe(false);
  });
});
