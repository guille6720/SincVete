import { describe, expect, it } from 'vitest';
import { vaccinationRecordSchema } from '../schemas';
import { addCalendarMonths, vaccinationDueStatus } from '../utils/vaccinations';

describe('vaccinationRecordSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates a basic vaccination', () => {
    const result = vaccinationRecordSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      vaccineName: 'Antirrábica',
      administeredAt: '2026-08-12',
      nextDueAt: '2027-08-12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manufacturer).toBeUndefined();
      expect(result.data.route).toBeUndefined();
    }
  });

  it('rejects a short vaccine name', () => {
    const result = vaccinationRecordSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      vaccineName: 'A',
      administeredAt: '2026-08-12',
    });
    expect(result.success).toBe(false);
  });

  it('rejects next due before administered date', () => {
    const result = vaccinationRecordSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      vaccineName: 'Antirrábica',
      administeredAt: '2026-08-12',
      nextDueAt: '2026-08-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty optional fields', () => {
    const result = vaccinationRecordSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      vaccineName: 'Triple felina (PRC)',
      administeredAt: '2026-08-12',
      manufacturer: '',
      lotNumber: '',
      nextDueAt: '',
      route: '',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nextDueAt).toBeUndefined();
      expect(result.data.lotNumber).toBeUndefined();
    }
  });
});

describe('addCalendarMonths', () => {
  it('adds twelve months', () => {
    expect(addCalendarMonths('2026-08-12', 12)).toBe('2027-08-12');
  });

  it('clamps end-of-month overflow', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('vaccinationDueStatus', () => {
  it('marks past dates as overdue', () => {
    expect(vaccinationDueStatus('2026-01-01', '2026-08-12')).toBe('vencida');
  });

  it('marks dates within 30 days as due soon', () => {
    expect(vaccinationDueStatus('2026-08-20', '2026-08-12')).toBe('por_vencer');
  });

  it('marks later dates as current', () => {
    expect(vaccinationDueStatus('2027-08-12', '2026-08-12')).toBe('al_dia');
  });

  it('marks missing dates', () => {
    expect(vaccinationDueStatus(null, '2026-08-12')).toBe('sin_fecha');
  });
});
