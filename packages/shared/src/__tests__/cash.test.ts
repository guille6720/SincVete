import { describe, expect, it } from 'vitest';
import { cashMovementSchema, cashSessionCloseSchema, cashSessionOpenSchema } from '../schemas';
import { computeExpectedCash, sumMovementsByMethod } from '../utils/cash';

describe('cashSessionOpenSchema', () => {
  it('accepts a zero float', () => {
    const result = cashSessionOpenSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      openingAmount: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative float', () => {
    const result = cashSessionOpenSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      openingAmount: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe('cashMovementSchema', () => {
  it('accepts an expense', () => {
    const result = cashMovementSchema.safeParse({
      kind: 'egreso',
      amount: 2500,
      notes: 'Taxi laboratorio',
    });
    expect(result.success).toBe(true);
  });

  it('rejects cobro as a manual movement', () => {
    const result = cashMovementSchema.safeParse({
      kind: 'cobro',
      amount: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe('cashSessionCloseSchema', () => {
  it('accepts counted cash', () => {
    const result = cashSessionCloseSchema.safeParse({ countedCash: 15000 });
    expect(result.success).toBe(true);
  });
});

describe('computeExpectedCash', () => {
  it('adds cash cobros and subtracts withdrawals', () => {
    expect(
      computeExpectedCash(10000, [
        { kind: 'cobro', method: 'efectivo', amount: 5000 },
        { kind: 'cobro', method: 'tarjeta', amount: 8000 },
        { kind: 'egreso', method: 'efectivo', amount: 2000 },
        { kind: 'retiro', method: 'efectivo', amount: 1000 },
      ])
    ).toBe(12000);
  });
});

describe('sumMovementsByMethod', () => {
  it('ignores cash outflows', () => {
    const rows = sumMovementsByMethod([
      { kind: 'cobro', method: 'efectivo', amount: 1000 },
      { kind: 'egreso', method: 'efectivo', amount: 200 },
      { kind: 'cobro', method: 'tarjeta', amount: 3000 },
    ]);
    expect(rows).toEqual([
      { method: 'efectivo', amount: 1000, count: 1 },
      { method: 'tarjeta', amount: 3000, count: 1 },
    ]);
  });
});
