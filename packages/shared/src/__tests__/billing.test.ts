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
  stripeEventFromBillingPayload,
  mercadoPagoPaymentIdFromBillingPayload,
  mercadoPagoTopicFromBillingPayload,
  shouldReleaseCheckoutIntent,
  shouldReversePaidGrant,
  isFullProviderRefund,
  collectProviderPaymentIds,
  refundCheckoutTargetFromMetadata,
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

  it('reads stored webhook payloads for Superadmin replay', () => {
    expect(stripeEventFromBillingPayload(null)).toBeNull();
    expect(stripeEventFromBillingPayload({ id: 'evt_1' })).toBeNull();
    expect(
      stripeEventFromBillingPayload({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1', payment_status: 'paid' } },
      })
    ).toEqual({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_status: 'paid' } },
    });
    expect(mercadoPagoPaymentIdFromBillingPayload({ status: 'approved' })).toBeNull();
    expect(mercadoPagoPaymentIdFromBillingPayload({ paymentId: '12345', type: 'payment' })).toBe(
      '12345'
    );
    expect(mercadoPagoTopicFromBillingPayload({ paymentId: '12345' })).toBe('payment');
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
    expect(shouldReversePaidGrant('rejected')).toBe(false);
  });

  it('reverses an applied grant only on refund or chargeback', () => {
    expect(shouldReversePaidGrant('refunded')).toBe(true);
    expect(shouldReversePaidGrant('charged_back')).toBe(true);
    expect(shouldReversePaidGrant('charge.refunded')).toBe(true);
    expect(shouldReversePaidGrant('charge.dispute.closed')).toBe(false);
    expect(shouldReversePaidGrant('rejected')).toBe(false);
    expect(shouldReversePaidGrant('cancelled')).toBe(false);
    expect(shouldReversePaidGrant('pending')).toBe(false);
    expect(shouldReversePaidGrant('approved')).toBe(false);
  });

  it('expires a grant only on a full refund, not a partial Stripe refund', () => {
    expect(isFullProviderRefund({ status: 'refunded' })).toBe(true);
    expect(isFullProviderRefund({ status: 'charged_back' })).toBe(true);
    expect(isFullProviderRefund({ eventType: 'charge.dispute.closed', status: 'lost' })).toBe(true);
    expect(isFullProviderRefund({ eventType: 'charge.dispute.closed', status: 'won' })).toBe(false);
    expect(
      isFullProviderRefund({ eventType: 'charge.refunded', refunded: true, amount: 39900, amountRefunded: 39900 })
    ).toBe(true);
    expect(
      isFullProviderRefund({ eventType: 'charge.refunded', refunded: false, amount: 39900, amountRefunded: 1000 })
    ).toBe(false);
    expect(isFullProviderRefund({ eventType: 'charge.refunded' })).toBe(false);
  });

  it('collects Stripe payment ids from a charge or checkout session', () => {
    expect(
      collectProviderPaymentIds({
        id: 'ch_123',
        payment_intent: 'pi_123',
        invoice: { id: 'in_123' },
      })
    ).toEqual(['ch_123', 'pi_123', 'in_123']);
  });

  it('reads checkout target from Stripe metadata when the charge has no reference string', () => {
    expect(
      refundCheckoutTargetFromMetadata({
        organization_id: '11111111-1111-1111-1111-111111111111',
        kind: 'plan',
        plan_key: COMMERCIAL_PLAN_KEYS.PRO,
      })
    ).toEqual({
      organizationId: '11111111-1111-1111-1111-111111111111',
      kind: 'plan',
      targetKey: COMMERCIAL_PLAN_KEYS.PRO,
    });
    expect(
      refundCheckoutTargetFromMetadata({
        reference: '11111111-1111-1111-1111-111111111111:addon:addon.ai:monthly',
      })
    ).toMatchObject({ kind: 'addon', targetKey: 'addon.ai' });
  });
});
