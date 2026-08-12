import { describe, expect, it } from 'vitest';
import { patientSchema } from '../schemas';

describe('patientSchema', () => {
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440000';

  it('validates minimal patient', () => {
    const result = patientSchema.safeParse({
      name: 'Firulais',
      ownerId: validOwnerId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Firulais');
      expect(result.data.species).toBe('Canino');
      expect(result.data.sex).toBe('Desconocido');
      expect(result.data.isNeutered).toBe(false);
      expect(result.data.isActive).toBe(true);
    }
  });

  it('trims patient name', () => {
    const result = patientSchema.safeParse({
      name: '  Michi  ',
      ownerId: validOwnerId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Michi');
    }
  });

  it('rejects missing owner', () => {
    const result = patientSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('clears empty optional fields', () => {
    const result = patientSchema.safeParse({
      name: 'Test',
      ownerId: validOwnerId,
      breed: '',
      microchip: '',
      branchId: '',
      birthDate: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.breed).toBeUndefined();
      expect(result.data.microchip).toBeUndefined();
      expect(result.data.branchId).toBeUndefined();
      expect(result.data.birthDate).toBeUndefined();
    }
  });

  it('rejects invalid birth date', () => {
    const result = patientSchema.safeParse({
      name: 'Test',
      ownerId: validOwnerId,
      birthDate: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });
});
