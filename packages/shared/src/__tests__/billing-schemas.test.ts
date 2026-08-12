import { describe, expect, it } from 'vitest';
import { invoiceCreateSchema, paymentSchema } from '../schemas';
import { formatMoney } from '../utils/billing';

const ownerId = '550e8400-e29b-41d4-a716-446655440001';
const patientId = '550e8400-e29b-41d4-a716-446655440000';

describe('invoiceCreateSchema', () => {
  it('validates an invoice with items', () => {
    const result = invoiceCreateSchema.safeParse({
      ownerId,
      patientId,
      items: [{ description: 'Consulta clínica', quantity: 1, unitPrice: 25000 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items', () => {
    const result = invoiceCreateSchema.safeParse({
      ownerId,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short description', () => {
    const result = invoiceCreateSchema.safeParse({
      ownerId,
      items: [{ description: '', quantity: 1, unitPrice: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentSchema', () => {
  it('accepts a cash payment', () => {
    const result = paymentSchema.safeParse({
      amount: 15000,
      method: 'efectivo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = paymentSchema.safeParse({
      amount: 0,
      method: 'efectivo',
    });
    expect(result.success).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats ARS in es-AR', () => {
    const formatted = formatMoney(25000.5, 'ARS');
    expect(formatted).toMatch(/25/);
    expect(formatted).toMatch(/ARS|\$/);
  });
});
