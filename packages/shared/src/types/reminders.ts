import type { ReminderType } from '../constants/reminders';

export interface ReminderItem {
  related_id: string;
  reminder_type: ReminderType;
  owner_id: string;
  owner_name: string;
  patient_id: string | null;
  patient_name: string | null;
  phone_whatsapp: string | null;
  phone: string | null;
  due_at: string;
  title: string;
  appointment_type: string | null;
  appointment_status: string | null;
  vaccine_name: string | null;
  due_status: string | null;
  invoice_number: string | null;
  balance: number | null;
  currency: string | null;
}

export interface ReminderBoard {
  appointments: ReminderItem[];
  vaccinations: ReminderItem[];
  invoices: ReminderItem[];
}

export const EMPTY_REMINDER_BOARD: ReminderBoard = {
  appointments: [],
  vaccinations: [],
  invoices: [],
};

export interface ReminderDispatchResult {
  url: string;
}
