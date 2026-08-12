import { describe, expect, it } from 'vitest';
import { prescriptionCreateSchema } from '../schemas';
import { formatPrescriptionItemLine } from '../utils/pharmacy';

describe('prescriptionCreateSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates a prescription with items', () => {
    const result = prescriptionCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      items: [
        {
          medicationName: 'Meloxicam',
          dose: '0.1 mg/kg',
          frequency: 'cada 24 h',
          duration: '5 días',
          route: 'oral',
          quantity: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items', () => {
    const result = prescriptionCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing medication name', () => {
    const result = prescriptionCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      items: [
        {
          medicationName: '',
          dose: '10 mg',
          frequency: 'cada 12 h',
          route: 'oral',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('formatPrescriptionItemLine', () => {
  it('joins dose, frequency and route', () => {
    expect(
      formatPrescriptionItemLine({
        medication_name: 'Meloxicam',
        dose: '0.1 mg/kg',
        frequency: 'cada 24 h',
        duration: '5 días',
        route: 'oral',
        instructions: 'Con comida',
      })
    ).toBe('Meloxicam · 0.1 mg/kg · cada 24 h · 5 días · Oral. Con comida');
  });
});
