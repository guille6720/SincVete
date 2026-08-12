import { describe, expect, it } from 'vitest';
import { consultationSoapSchema, consultationStartSchema } from '../schemas';

describe('consultationStartSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates walk-in start', () => {
    const result = consultationStartSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing patient', () => {
    const result = consultationStartSchema.safeParse({
      ownerId: validOwnerId,
    });
    expect(result.success).toBe(false);
  });
});

describe('consultationSoapSchema', () => {
  it('accepts empty SOAP draft', () => {
    const result = consultationSoapSchema.safeParse({
      title: '',
      anamnesis: '',
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
    const result = consultationSoapSchema.safeParse({
      temperatureC: 12,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid vitals', () => {
    const result = consultationSoapSchema.safeParse({
      weightKg: 12.5,
      temperatureC: 38.4,
      diagnosis: 'Otitis',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightKg).toBe(12.5);
      expect(result.data.diagnosis).toBe('Otitis');
    }
  });
});
