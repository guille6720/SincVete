import { describe, expect, it } from 'vitest';
import { surgeryScheduleSchema, surgeryWorksheetSchema } from '../schemas';

describe('surgeryScheduleSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates a scheduled surgery', () => {
    const result = surgeryScheduleSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      procedureName: 'Castración',
      scheduledAt: '2026-08-12T09:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.asa).toBeUndefined();
    }
  });

  it('rejects a short procedure name', () => {
    const result = surgeryScheduleSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      procedureName: 'A',
      scheduledAt: '2026-08-12T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing patient', () => {
    const result = surgeryScheduleSchema.safeParse({
      ownerId: validOwnerId,
      procedureName: 'Castración',
      scheduledAt: '2026-08-12T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('surgeryWorksheetSchema', () => {
  it('accepts empty worksheet draft', () => {
    const result = surgeryWorksheetSchema.safeParse({
      diagnosis: '',
      preopNotes: '',
      intraopNotes: '',
      asa: '',
      anesthesia: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diagnosis).toBeUndefined();
      expect(result.data.asa).toBeUndefined();
    }
  });

  it('accepts ASA and anesthesia', () => {
    const result = surgeryWorksheetSchema.safeParse({
      asa: 'II',
      anesthesia: 'general',
      diagnosis: 'Piometra',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.asa).toBe('II');
      expect(result.data.anesthesia).toBe('general');
    }
  });
});
