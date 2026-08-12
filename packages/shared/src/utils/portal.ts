import type {
  OwnerPortalHome,
  OwnerPortalPatient,
  OwnerPortalStatus,
  PortalAppointmentRow,
  PortalClinicalRow,
  PortalInviteCreated,
  PortalInvitePreview,
  PortalInvoiceRow,
  PortalPatientSummary,
  PortalVaccineDueRow,
} from '../types/portal';
import type { PatientSpecies, PatientSex } from '../constants/patients';
import type { AppointmentStatus, AppointmentType } from '../constants/appointments';
import type { ClinicalEntryType } from '../constants/clinical';
import type { InvoiceStatus } from '../constants/billing';
import type { VaccinationDueStatus } from '../constants/vaccinations';
import type { PortalAccessStatus } from '../constants/portal';

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

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

export function isNonEmptyPortalPayload(raw: unknown): boolean {
  const data = asRecord(raw);
  if (!data) return false;
  return Object.keys(data).length > 0;
}

export function parsePortalInvitePreview(raw: unknown): PortalInvitePreview | null {
  const data = asRecord(raw);
  if (!data || data.valid !== true) return null;
  return {
    valid: true,
    email: str(data.email),
    ownerName: str(data.owner_name),
    clinicName: str(data.clinic_name),
    expiresAt: str(data.expires_at),
  };
}

export function parsePortalInviteCreated(raw: unknown): PortalInviteCreated | null {
  const data = asRecord(raw);
  if (!data || !data.token) return null;
  return {
    token: str(data.token),
    email: str(data.email),
    expiresAt: str(data.expires_at),
  };
}

export function parseOwnerPortalStatus(raw: unknown): OwnerPortalStatus | null {
  const data = asRecord(raw);
  if (!data || !data.status) return null;
  return {
    status: str(data.status) as PortalAccessStatus,
    email: strOrNull(data.email),
    expiresAt: strOrNull(data.expires_at),
    portalUserId: strOrNull(data.portal_user_id),
  };
}

function parsePatientSummary(raw: unknown): PortalPatientSummary | null {
  const data = asRecord(raw);
  if (!data || !data.id) return null;
  return {
    id: str(data.id),
    name: str(data.name),
    species: str(data.species) as PatientSpecies,
    breed: strOrNull(data.breed),
    sex: str(data.sex) as PatientSex,
    birthDate: strOrNull(data.birth_date),
    isDeceased: bool(data.is_deceased),
  };
}

function parseAppointment(raw: unknown): PortalAppointmentRow | null {
  const data = asRecord(raw);
  if (!data || !data.id) return null;
  return {
    id: str(data.id),
    patientId: strOrNull(data.patient_id),
    patientName: strOrNull(data.patient_name),
    startsAt: str(data.starts_at),
    endsAt: str(data.ends_at),
    status: str(data.status) as AppointmentStatus,
    appointmentType: str(data.appointment_type) as AppointmentType,
    title: strOrNull(data.title),
  };
}

function parseVaccine(raw: unknown): PortalVaccineDueRow | null {
  const data = asRecord(raw);
  if (!data || !data.id) return null;
  return {
    id: str(data.id),
    patientId: strOrNull(data.patient_id),
    patientName: strOrNull(data.patient_name),
    vaccineName: str(data.vaccine_name),
    administeredAt: str(data.administered_at),
    nextDueAt: strOrNull(data.next_due_at),
    dueStatus: str(data.due_status) as VaccinationDueStatus,
  };
}

function parseInvoice(raw: unknown): PortalInvoiceRow | null {
  const data = asRecord(raw);
  if (!data || !data.id) return null;
  return {
    id: str(data.id),
    number: strOrNull(data.number),
    status: str(data.status) as InvoiceStatus,
    currency: str(data.currency) || 'ARS',
    issuedAt: strOrNull(data.issued_at),
    dueAt: strOrNull(data.due_at),
    total: num(data.total),
    paidAmount: num(data.paid_amount),
    balance: num(data.balance),
    patientName: strOrNull(data.patient_name),
  };
}

function parseClinical(raw: unknown): PortalClinicalRow | null {
  const data = asRecord(raw);
  if (!data || !data.id) return null;
  return {
    id: str(data.id),
    patientId: strOrNull(data.patient_id),
    patientName: strOrNull(data.patient_name),
    entryDate: str(data.entry_date),
    entryType: str(data.entry_type) as ClinicalEntryType,
    title: strOrNull(data.title),
    diagnosis: strOrNull(data.diagnosis),
    treatment: strOrNull(data.treatment),
    plan: strOrNull(data.plan),
    weightKg: numOrNull(data.weight_kg),
  };
}

function mapList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parse).filter((item): item is T => item !== null);
}

export function parseOwnerPortalHome(raw: unknown): OwnerPortalHome | null {
  const data = asRecord(raw);
  if (!data) return null;
  const clinic = asRecord(data.clinic);
  const owner = asRecord(data.owner);
  if (!clinic || !owner || !owner.id) return null;

  return {
    clinic: {
      name: str(clinic.name),
      phone: strOrNull(clinic.phone),
      email: strOrNull(clinic.email),
    },
    owner: {
      id: str(owner.id),
      fullName: str(owner.full_name),
      email: strOrNull(owner.email),
      phone: strOrNull(owner.phone),
    },
    patients: mapList(data.patients, parsePatientSummary),
    upcomingAppointments: mapList(data.upcoming_appointments, parseAppointment),
    vaccinesDue: mapList(data.vaccines_due, parseVaccine),
    invoices: mapList(data.invoices, parseInvoice),
    recentClinical: mapList(data.recent_clinical, parseClinical),
  };
}

export function parseOwnerPortalPatient(raw: unknown): OwnerPortalPatient | null {
  const data = asRecord(raw);
  if (!data) return null;
  const patient = parsePatientSummary(data.patient);
  const extra = asRecord(data.patient);
  if (!patient || !extra) return null;

  return {
    patient: {
      ...patient,
      color: strOrNull(extra.color),
      microchip: strOrNull(extra.microchip),
      isNeutered: bool(extra.is_neutered),
    },
    vaccines: mapList(data.vaccines, parseVaccine),
    appointments: mapList(data.appointments, parseAppointment),
    clinical: mapList(data.clinical, parseClinical),
  };
}
