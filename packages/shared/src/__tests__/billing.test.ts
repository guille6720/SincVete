import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PLAN_KEYS,
  FALLBACK_PUBLIC_PLANS,
  amountForInterval,
  canCheckoutPlan,
  encodeCheckoutReference,
  isPurchasablePlanKey,
  parseCheckoutReference,
  parsePlanPricing,
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
});
