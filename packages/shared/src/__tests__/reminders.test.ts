import { describe, expect, it } from 'vitest';
import { reminderActionSchema } from '../schemas';
import {
  canAccessReminders,
  reminderTemplateForType,
} from '../constants/reminders';
import {
  countPendingReminders,
  parseClinicReminders,
  reminderHasPhone,
} from '../utils/reminders';
import { EMPTY_REMINDER_BOARD } from '../types/reminders';

describe('canAccessReminders', () => {
  it('allows staff with any related read permission', () => {
    expect(canAccessReminders(['appointments:read'])).toBe(true);
    expect(canAccessReminders(['clinical:read'])).toBe(true);
    expect(canAccessReminders(['billing:read'])).toBe(true);
    expect(canAccessReminders(['whatsapp:send'])).toBe(true);
  });

  it('rejects users without reminder access', () => {
    expect(canAccessReminders(['inventory:read'])).toBe(false);
    expect(canAccessReminders([])).toBe(false);
  });
});

describe('reminderTemplateForType', () => {
  it('maps each queue to a WhatsApp template', () => {
    expect(reminderTemplateForType('appointment')).toBe('recordatorio_cita');
    expect(reminderTemplateForType('vaccination')).toBe('vacuna_vencida');
    expect(reminderTemplateForType('invoice')).toBe('factura_saldo');
  });
});

describe('reminderActionSchema', () => {
  it('accepts a valid action', () => {
    const result = reminderActionSchema.safeParse({
      reminderType: 'appointment',
      relatedId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid type', () => {
    const result = reminderActionSchema.safeParse({
      reminderType: 'lab',
      relatedId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(false);
  });
});

describe('parseClinicReminders', () => {
  it('parses a board payload', () => {
    const board = parseClinicReminders({
      appointments: [
        {
          related_id: '11111111-1111-1111-1111-111111111111',
          reminder_type: 'appointment',
          owner_id: '22222222-2222-2222-2222-222222222222',
          owner_name: 'Ana',
          patient_id: '33333333-3333-3333-3333-333333333333',
          patient_name: 'Luna',
          phone_whatsapp: '11 2345-6789',
          phone: null,
          due_at: '2026-08-13T18:00:00.000Z',
          title: 'Consulta',
          appointment_type: 'consulta',
          appointment_status: 'programada',
        },
      ],
      vaccinations: [],
      invoices: [],
    });

    expect(board.appointments).toHaveLength(1);
    expect(board.appointments[0]?.owner_name).toBe('Ana');
    expect(countPendingReminders(board)).toBe(1);
    expect(reminderHasPhone(board.appointments[0]!)).toBe(true);
  });

  it('returns an empty board for invalid payloads', () => {
    expect(parseClinicReminders(null)).toEqual(EMPTY_REMINDER_BOARD);
    expect(countPendingReminders(EMPTY_REMINDER_BOARD)).toBe(0);
  });
});
