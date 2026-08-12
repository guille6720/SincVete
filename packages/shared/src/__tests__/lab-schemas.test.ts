import { describe, expect, it } from 'vitest';
import { labOrderCreateSchema, labResultsSchema } from '../schemas';

describe('labOrderCreateSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates an order with tests', () => {
    const result = labOrderCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      title: 'Hemograma completo',
      tests: ['Hematocrito', 'Leucocitos'],
      priority: 'rutina',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty tests', () => {
    const result = labOrderCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      title: 'Hemograma',
      tests: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a short title', () => {
    const result = labOrderCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      title: 'A',
      tests: ['Hematocrito'],
    });
    expect(result.success).toBe(false);
  });
});

describe('labResultsSchema', () => {
  it('accepts item results', () => {
    const result = labResultsSchema.safeParse({
      interpretation: 'Leucocitosis leve',
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          resultValue: '18.2',
          unit: 'x10^3/µL',
          referenceRange: '6-17',
          flag: 'alto',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid flag', () => {
    const result = labResultsSchema.safeParse({
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          flag: 'critico',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
