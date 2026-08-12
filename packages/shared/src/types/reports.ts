import type { PatientSpecies } from '../constants/patients';
import type { AppointmentStatus } from '../constants/appointments';
import type { PaymentMethod } from '../constants/billing';

export interface ReportStatusCount {
  status: AppointmentStatus | string;
  count: number;
}

export interface ReportSpeciesCount {
  species: PatientSpecies;
  count: number;
}

export interface ReportPaymentMethodRow {
  method: PaymentMethod | string;
  count: number;
  amount: number;
}

export interface ReportDailyRow {
  day: string;
  appointments: number;
  consultations: number;
  payments_total: number;
}

export interface ReportOperations {
  newPatients: number;
  newOwners: number;
  appointmentsTotal: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  consultationsCompleted: number;
  hospitalizationsAdmitted: number;
  vaccinationsRecorded: number;
  surgeriesCompleted: number;
  labOrdersCompleted: number;
  appointmentsByStatus: ReportStatusCount[];
  consultationsBySpecies: ReportSpeciesCount[];
}

export interface ReportBilling {
  invoicesIssuedCount: number;
  invoicesIssuedTotal: number;
  invoicesVoidedCount: number;
  paymentsCount: number;
  paymentsTotal: number;
  openBalance: number;
  paymentsByMethod: ReportPaymentMethodRow[];
}

export interface ReportInventory {
  lowStockCount: number;
  movementsEntrada: number;
  movementsSalida: number;
  movementsAjuste: number;
  movementsDescarte: number;
}

export interface ClinicReport {
  from: string;
  to: string;
  operations: ReportOperations | null;
  billing: ReportBilling | null;
  inventory: ReportInventory | null;
  daily: ReportDailyRow[];
}
