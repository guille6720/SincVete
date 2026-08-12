import { describe, expect, it } from 'vitest';
import { appointmentSchema } from '../schemas';

describe('appointmentSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates minimal appointment', () => {
    const result = appointmentSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      startsAt: '2024-08-15T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointmentType).toBe('consulta');
      expect(result.data.durationMinutes).toBe(30);
    }
  });

  it('rejects missing patient', () => {
    const result = appointmentSchema.safeParse({
      ownerId: validOwnerId,
      startsAt: '2024-08-15T12:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('clears empty optional fields', () => {
    const result = appointmentSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      startsAt: '2024-08-15T12:00:00.000Z',
      assignedUserId: '',
      title: '',
      notes: '',
      branchId: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedUserId).toBeUndefined();
      expect(result.data.title).toBeUndefined();
      expect(result.data.branchId).toBeUndefined();
    }
  });
});
