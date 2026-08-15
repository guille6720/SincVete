'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  vaccinationListSchema,
  vaccinationRecordSchema,
  vaccinationUpdateSchema,
  type ActionResult,
  type PaginatedResult,
  type Vaccination,
  type VaccinationDueRow,
  type VaccinationDueStatus,
  type VaccinationListRow,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: string }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (isNextRedirect(error)) throw error;
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function toVaccinationListRow(
  row: VaccinationListRow & { total_count?: number; due_status?: string }
): VaccinationListRow {
  const { total_count: _total, due_status: _due, ...entry } = row;
  void _total;
  void _due;
  return {
    ...entry,
    deleted_at: entry.deleted_at ?? null,
  };
}

function toVaccinationDueRow(
  row: VaccinationDueRow & { total_count?: number }
): VaccinationDueRow {
  return {
    ...toVaccinationListRow(row),
    due_status: row.due_status,
  };
}

export async function listVaccinationDue(): Promise<VaccinationDueRow[]> {
  await requirePermission('clinical:read');
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('list_vaccination_due', {
    p_branch_id: session?.branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) =>
    toVaccinationDueRow({
      ...(row as VaccinationDueRow),
      due_status: row.due_status as VaccinationDueStatus,
    })
  );
}

export async function listPatientVaccineStatus(patientId: string): Promise<VaccinationDueRow[]> {
  const session = await getSessionContext();
  if (!session || !session.permissions.includes('clinical:read')) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('list_patient_vaccine_status', {
    p_patient_id: patientId,
  });

  if (error) throw error;
  return (data ?? []).map((row) =>
    toVaccinationDueRow({
      ...(row as VaccinationDueRow),
      due_status: row.due_status as VaccinationDueStatus,
    })
  );
}

export async function listVaccinations(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    patientId?: string;
    branchId?: string;
  } = {}
): Promise<PaginatedResult<VaccinationListRow>> {
  await requirePermission('clinical:read');
  const parsed = vaccinationListSchema.parse(input);
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_vaccinations', {
    p_search: parsed.search?.trim() || null,
    p_patient_id: parsed.patientId || null,
    p_branch_id: parsed.branchId ?? session?.branchId ?? null,
    p_page: parsed.page,
    p_page_size: parsed.pageSize,
  });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const vaccinations = rows.map((row) =>
    toVaccinationListRow(row as VaccinationListRow & { total_count: number })
  );

  return buildPaginatedResult(vaccinations, Number(total), parsed.page, parsed.pageSize);
}

export async function getVaccination(id: string): Promise<VaccinationListRow | null> {
  await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data: vaccination, error } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !vaccination) return null;

  const [{ data: patient }, { data: owner }, profileResult] = await Promise.all([
    supabase.from('patients').select('name, species').eq('id', vaccination.patient_id).single(),
    supabase.from('owners').select('full_name').eq('id', vaccination.owner_id).single(),
    vaccination.veterinarian_id
      ? supabase.from('profiles').select('full_name').eq('id', vaccination.veterinarian_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!patient || !owner) return null;

  return {
    ...(vaccination as Vaccination),
    patient_name: patient.name,
    patient_species: patient.species as VaccinationListRow['patient_species'],
    owner_full_name: owner.full_name,
    veterinarian_name: profileResult.data?.full_name ?? null,
  };
}

export async function recordVaccinationAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('clinical:write');
    const parsed = vaccinationRecordSchema.safeParse({
      patientId: formData.get('patientId'),
      ownerId: formData.get('ownerId'),
      branchId: formData.get('branchId'),
      consultationId: formData.get('consultationId'),
      vaccineName: formData.get('vaccineName'),
      manufacturer: formData.get('manufacturer'),
      lotNumber: formData.get('lotNumber'),
      administeredAt: formData.get('administeredAt'),
      nextDueAt: formData.get('nextDueAt'),
      route: formData.get('route'),
      notes: formData.get('notes'),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const branchId = parsed.data.branchId ?? session.branchId;
    if (!branchId) {
      return { success: false, error: 'Seleccioná una sucursal activa' };
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('record_vaccination', {
      p_branch_id: branchId,
      p_patient_id: parsed.data.patientId,
      p_owner_id: parsed.data.ownerId,
      p_vaccine_name: parsed.data.vaccineName,
      p_administered_at: parsed.data.administeredAt,
      p_manufacturer: parsed.data.manufacturer ?? null,
      p_lot_number: parsed.data.lotNumber ?? null,
      p_next_due_at: parsed.data.nextDueAt ?? null,
      p_route: parsed.data.route ?? null,
      p_notes: parsed.data.notes ?? null,
      p_consultation_id: parsed.data.consultationId ?? null,
    });

    if (error) {
      return { success: false, error: error.message || 'No se pudo registrar la vacunación' };
    }

    const result = data as { vaccination_id?: string; clinical_entry_id?: string } | null;

    revalidatePath('/vacunacion');
    revalidatePath(`/pacientes/${parsed.data.patientId}`);
    revalidatePath(`/pacientes/${parsed.data.patientId}/historia`);

    if (result?.clinical_entry_id) {
      revalidatePath(`/historia-clinica/${result.clinical_entry_id}`);
      revalidatePath('/historia-clinica');
    }

    if (result?.vaccination_id) {
      redirect(`/vacunacion/${result.vaccination_id}`);
    }

    return { success: false, error: 'No se pudo registrar la vacunación' };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateVaccination(
  vaccinationId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = vaccinationUpdateSchema.safeParse({
      administeredAt: formData.get('administeredAt'),
      manufacturer: formData.get('manufacturer'),
      lotNumber: formData.get('lotNumber'),
      nextDueAt: formData.get('nextDueAt'),
      route: formData.get('route'),
      notes: formData.get('notes'),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('vaccinations')
      .update({
        manufacturer: parsed.data.manufacturer ?? null,
        lot_number: parsed.data.lotNumber ?? null,
        next_due_at: parsed.data.nextDueAt ?? null,
        route: parsed.data.route ?? null,
        notes: parsed.data.notes ?? null,
      })
      .eq('id', vaccinationId);

    if (error) {
      return { success: false, error: 'No se pudo actualizar la vacunación' };
    }

    revalidatePath('/vacunacion');
    revalidatePath(`/vacunacion/${vaccinationId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function canManageVaccinations(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:write');
}

export async function canReadVaccinations(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:read');
}
