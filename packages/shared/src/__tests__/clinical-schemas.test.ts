import { describe, expect, it } from 'vitest';
import { clinicalEntrySchema } from '../schemas';

describe('clinicalEntrySchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates minimal clinical entry', () => {
    const result = clinicalEntrySchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      entryDate: '2024-08-15T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entryType).toBe('consulta');
    }
  });

  it('rejects missing patient', () => {
    const result = clinicalEntrySchema.safeParse({
      ownerId: validOwnerId,
      entryDate: '2024-08-15T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('clears empty optional fields', () => {
    const result = clinicalEntrySchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      entryDate: '2024-08-15T12:00:00.000Z',
      title: '',
      diagnosis: '',
      weightKg: '',
      temperatureC: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeUndefined();
      expect(result.data.weightKg).toBeUndefined();
    }
  });

  it('rejects invalid temperature', () => {
    const result = clinicalEntrySchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      entryDate: '2024-08-15T12:00:00.000Z',
      temperatureC: 100,
    });
    expect(result.success).toBe(false);
  });
});
