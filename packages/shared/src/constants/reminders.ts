import type { WhatsAppTemplateKey } from './whatsapp';

export const REMINDER_TYPES = ['appointment', 'vaccination', 'invoice'] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  appointment: 'Turnos',
  vaccination: 'Vacunas',
  invoice: 'Saldos',
};

export const REMINDER_STATUSES = ['enviado', 'omitido'] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_HORIZON_HOURS = 48;

export const REMINDER_ACCESS_PERMISSIONS = [
  'appointments:read',
  'clinical:read',
  'billing:read',
  'whatsapp:send',
] as const;

export const REMINDER_WHATSAPP_TEMPLATE: Record<ReminderType, WhatsAppTemplateKey> = {
  appointment: 'recordatorio_cita',
  vaccination: 'vacuna_vencida',
  invoice: 'factura_saldo',
};

export function canAccessReminders(permissions: readonly string[]): boolean {
  return REMINDER_ACCESS_PERMISSIONS.some((permission) => permissions.includes(permission));
}

export function reminderTemplateForType(type: ReminderType): WhatsAppTemplateKey {
  return REMINDER_WHATSAPP_TEMPLATE[type];
}
