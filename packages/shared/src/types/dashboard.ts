import type { PatientSpecies } from '../constants/patients';

export interface DashboardSpeciesCount {
  species: PatientSpecies;
  count: number;
}

export interface DashboardRecentPatient {
  id: string;
  name: string;
  species: PatientSpecies;
  owner_full_name: string;
  created_at: string;
}

export interface DashboardRecentOwner {
  id: string;
  full_name: string;
  created_at: string;
}

export interface DashboardSummary {
  activePatients: number;
  activeOwners: number;
  patientsThisMonth: number;
  ownersThisMonth: number;
  appointmentsToday: number;
  consultationsThisMonth: number;
  hospitalizationsActive: number;
  vaccinationsOverdue: number;
  surgeriesActive: number;
  labOrdersPending: number;
  inventoryLowStock: number;
  invoicesOpen: number;
  remindersPending: number;
  prescriptionsActive: number;
  cashSessionsOpen: number;
  clinicalImagesThisMonth: number;
  notificationsUnread: number;
  auditEventsToday: number;
  speciesCounts: DashboardSpeciesCount[];
  recentPatients: DashboardRecentPatient[];
  recentOwners: DashboardRecentOwner[];
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userFullName: string | null;
  summary: string;
  createdAt: string;
}

export interface DashboardContext {
  organizationName: string;
  branchName: string | null;
  canWritePatients: boolean;
  canViewActivity: boolean;
}

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummary = {
  activePatients: 0,
  activeOwners: 0,
  patientsThisMonth: 0,
  ownersThisMonth: 0,
  appointmentsToday: 0,
  consultationsThisMonth: 0,
  hospitalizationsActive: 0,
  vaccinationsOverdue: 0,
  surgeriesActive: 0,
  labOrdersPending: 0,
  inventoryLowStock: 0,
  invoicesOpen: 0,
  remindersPending: 0,
  prescriptionsActive: 0,
  cashSessionsOpen: 0,
  clinicalImagesThisMonth: 0,
  notificationsUnread: 0,
  auditEventsToday: 0,
  speciesCounts: [],
  recentPatients: [],
  recentOwners: [],
};
