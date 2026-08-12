import {
  REMINDER_TYPES,
  type ReminderType,
} from '../constants/reminders';
import {
  EMPTY_REMINDER_BOARD,
  type ReminderBoard,
  type ReminderItem,
} from '../types/reminders';
import { pickOwnerWhatsAppPhone } from './whatsapp';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function strOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isReminderType(value: string): value is ReminderType {
  return (REMINDER_TYPES as readonly string[]).includes(value);
}

export function parseReminderItem(raw: unknown): ReminderItem | null {
  const data = asRecord(raw);
  if (!data) return null;

  const relatedId = strOrNull(data.related_id);
  const type = str(data.reminder_type);
  const ownerId = strOrNull(data.owner_id);
  if (!relatedId || !ownerId || !isReminderType(type)) return null;

  return {
    related_id: relatedId,
    reminder_type: type,
    owner_id: ownerId,
    owner_name: str(data.owner_name),
    patient_id: strOrNull(data.patient_id),
    patient_name: strOrNull(data.patient_name),
    phone_whatsapp: strOrNull(data.phone_whatsapp),
    phone: strOrNull(data.phone),
    due_at: str(data.due_at),
    title: str(data.title) || 'Recordatorio',
    appointment_type: strOrNull(data.appointment_type),
    appointment_status: strOrNull(data.appointment_status),
    vaccine_name: strOrNull(data.vaccine_name),
    due_status: strOrNull(data.due_status),
    invoice_number: strOrNull(data.invoice_number),
    balance: numOrNull(data.balance),
    currency: strOrNull(data.currency),
  };
}

function parseReminderList(raw: unknown): ReminderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseReminderItem).filter((item): item is ReminderItem => item !== null);
}

export function parseClinicReminders(raw: unknown): ReminderBoard {
  const data = asRecord(raw);
  if (!data) return EMPTY_REMINDER_BOARD;

  return {
    appointments: parseReminderList(data.appointments),
    vaccinations: parseReminderList(data.vaccinations),
    invoices: parseReminderList(data.invoices),
  };
}

export function countPendingReminders(board: ReminderBoard): number {
  return board.appointments.length + board.vaccinations.length + board.invoices.length;
}

export function reminderHasPhone(item: Pick<ReminderItem, 'phone_whatsapp' | 'phone'>): boolean {
  return pickOwnerWhatsAppPhone(item.phone_whatsapp, item.phone) !== null;
}
