import { describe, expect, it } from 'vitest';
import {
  hospitalizationAdmitSchema,
  hospitalizationDischargeSchema,
  hospitalizationNoteSchema,
} from '../schemas';
import { hospitalizationStayDays } from '../utils/hospitalizations';

describe('hospitalizationAdmitSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates a basic admission', () => {
    const result = hospitalizationAdmitSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      reason: 'Vómitos persistentes',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('internado');
      expect(result.data.cage).toBeUndefined();
    }
  });

  it('rejects a short reason', () => {
    const result = hospitalizationAdmitSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      reason: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing patient', () => {
    const result = hospitalizationAdmitSchema.safeParse({
      ownerId: validOwnerId,
      reason: 'Observación postquirúrgica',
    });
    expect(result.success).toBe(false);
  });
});

describe('hospitalizationNoteSchema', () => {
  it('accepts an evolution note with vitals', () => {
    const result = hospitalizationNoteSchema.safeParse({
      noteType: 'evolucion',
      content: 'Come y bebe. Mucosas rosadas.',
      weightKg: 8.2,
      temperatureC: 38.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightKg).toBe(8.2);
    }
  });

  it('rejects empty content', () => {
    const result = hospitalizationNoteSchema.safeParse({
      noteType: 'evolucion',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid temperature', () => {
    const result = hospitalizationNoteSchema.safeParse({
      noteType: 'vitals',
      content: 'Control de temperatura',
      temperatureC: 12,
    });
    expect(result.success).toBe(false);
  });
});

describe('hospitalizationDischargeSchema', () => {
  it('accepts alta with summary', () => {
    const result = hospitalizationDischargeSchema.safeParse({
      outcome: 'alta',
      summary: 'Evolución favorable. Continuar dieta blanda.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid outcome', () => {
    const result = hospitalizationDischargeSchema.safeParse({
      outcome: 'internado',
    });
    expect(result.success).toBe(false);
  });
});

describe('hospitalizationStayDays', () => {
  it('counts admission day as day 1', () => {
    const admitted = new Date().toISOString();
    expect(hospitalizationStayDays(admitted)).toBe(1);
  });
});
