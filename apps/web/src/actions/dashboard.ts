'use server';

import {
  EMPTY_DASHBOARD_SUMMARY,
  hasPermission,
  type DashboardActivityItem,
  type DashboardContext,
  type DashboardRecentOwner,
  type DashboardRecentPatient,
  type DashboardSpeciesCount,
  type DashboardSummary,
  type PatientSpecies,
} from '@sincvete/shared';
import { getSessionContext } from '@/actions/auth';
import { createServerClient } from '@/lib/supabase/server';

interface DashboardSummaryRow {
  active_patients?: number;
  active_owners?: number;
  patients_this_month?: number;
  owners_this_month?: number;
  appointments_today?: number;
  consultations_this_month?: number;
  hospitalizations_active?: number;
  vaccinations_overdue?: number;
  surgeries_active?: number;
  lab_orders_pending?: number;
  inventory_low_stock?: number;
  invoices_open?: number;
  reminders_pending?: number;
  prescriptions_active?: number;
  cash_sessions_open?: number;
  clinical_images_this_month?: number;
  notifications_unread?: number;
  audit_events_today?: number;
  species_counts?: Array<{ species: string; count: number }>;
  recent_patients?: DashboardRecentPatient[];
  recent_owners?: DashboardRecentOwner[];
}

function parseSummary(data: DashboardSummaryRow | null): DashboardSummary {
  if (!data) return EMPTY_DASHBOARD_SUMMARY;

  return {
    activePatients: Number(data.active_patients ?? 0),
    activeOwners: Number(data.active_owners ?? 0),
    patientsThisMonth: Number(data.patients_this_month ?? 0),
    ownersThisMonth: Number(data.owners_this_month ?? 0),
    appointmentsToday: Number(data.appointments_today ?? 0),
    consultationsThisMonth: Number(data.consultations_this_month ?? 0),
    hospitalizationsActive: Number(data.hospitalizations_active ?? 0),
    vaccinationsOverdue: Number(data.vaccinations_overdue ?? 0),
    surgeriesActive: Number(data.surgeries_active ?? 0),
    labOrdersPending: Number(data.lab_orders_pending ?? 0),
    inventoryLowStock: Number(data.inventory_low_stock ?? 0),
    invoicesOpen: Number(data.invoices_open ?? 0),
    remindersPending: Number(data.reminders_pending ?? 0),
    prescriptionsActive: Number(data.prescriptions_active ?? 0),
    cashSessionsOpen: Number(data.cash_sessions_open ?? 0),
    clinicalImagesThisMonth: Number(data.clinical_images_this_month ?? 0),
    notificationsUnread: Number(data.notifications_unread ?? 0),
    auditEventsToday: Number(data.audit_events_today ?? 0),
    speciesCounts: (data.species_counts ?? []).map(
      (item): DashboardSpeciesCount => ({
        species: item.species as PatientSpecies,
        count: Number(item.count),
      })
    ),
    recentPatients: data.recent_patients ?? [],
    recentOwners: data.recent_owners ?? [],
  };
}

export async function getDashboardSummary(
  branchId?: string | null
): Promise<DashboardSummary> {
  const session = await getSessionContext();
  if (!session || !session.permissions.includes('patients:read')) {
    return EMPTY_DASHBOARD_SUMMARY;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_branch_id: branchId ?? session.branchId ?? null,
  });

  if (error) throw error;
  return parseSummary(data as DashboardSummaryRow | null);
}

export async function getDashboardActivity(limit = 10): Promise<DashboardActivityItem[]> {
  const session = await getSessionContext();
  if (!session || !hasPermission(session.permissions, 'audit:read')) {
    return [];
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('get_dashboard_activity', {
    p_limit: limit,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    userFullName: row.user_full_name,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function getDashboardContext(): Promise<DashboardContext | null> {
  const session = await getSessionContext();
  if (!session) return null;

  const supabase = await createServerClient();

  const [{ data: org }, branchResult] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', session.organizationId).single(),
    session.branchId
      ? supabase.from('branches').select('name').eq('id', session.branchId).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    organizationName: org?.name ?? 'Clínica',
    branchName: branchResult.data?.name ?? null,
    canWritePatients: session.permissions.includes('patients:write'),
    canViewActivity: session.permissions.includes('audit:read'),
  };
}

export async function getDashboardData() {
  const session = await getSessionContext();
  const branchId = session?.branchId ?? null;

  const [context, summary, activity] = await Promise.all([
    getDashboardContext(),
    getDashboardSummary(branchId),
    getDashboardActivity(),
  ]);

  return { context, summary, activity, session };
}
