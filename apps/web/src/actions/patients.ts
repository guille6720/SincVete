'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  patientListSchema,
  patientSchema,
  type ActionResult,
  type Patient,
  type PatientListRow,
  type PaginatedResult,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    name: formData.get('name'),
    ownerId: formData.get('ownerId'),
    species: formData.get('species') || 'Canino',
    breed: formData.get('breed'),
    sex: formData.get('sex') || 'Desconocido',
    birthDate: formData.get('birthDate'),
    color: formData.get('color'),
    microchip: formData.get('microchip'),
    isNeutered: formData.has('isNeutered')
      ? formData.get('isNeutered') === 'true'
      : false,
    isDeceased: formData.has('isDeceased')
      ? formData.get('isDeceased') === 'true'
      : false,
    deceasedAt: formData.get('deceasedAt'),
    notes: formData.get('notes'),
    branchId: formData.get('branchId'),
    isActive: formData.has('isActive')
      ? formData.get('isActive') === 'true'
      : true,
  });
}

function toPatientListRow(row: PatientListRow & { total_count?: number }): PatientListRow {
  const { total_count: _total, ...patient } = row;
  void _total;
  return { ...patient, deleted_at: patient.deleted_at ?? null };
}

export async function listPatients(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    ownerId?: string;
    branchId?: string;
    species?: string;
  } = {}
): Promise<PaginatedResult<PatientListRow>> {
  await requirePermission('patients:read');
  const parsed = patientListSchema.parse(input);
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_patients', {
    p_search: parsed.search?.trim() || null,
    p_owner_id: parsed.ownerId || null,
    p_branch_id: parsed.branchId || null,
    p_species: parsed.species || null,
    p_page: parsed.page,
    p_page_size: parsed.pageSize,
  });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const patients = rows.map((row) =>
    toPatientListRow(row as PatientListRow & { total_count: number })
  );

  return buildPaginatedResult(patients, Number(total), parsed.page, parsed.pageSize);
}

export async function getPatient(id: string): Promise<Patient | null> {
  await requirePermission('patients:read');
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return null;
  return data as Patient;
}

export async function createPatient(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('patients:write');
    const parsed = parsePatientForm(formData);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('patients')
      .insert({
        organization_id: session.organizationId,
        branch_id: parsed.data.branchId || session.branchId,
        owner_id: parsed.data.ownerId,
        name: parsed.data.name,
        species: parsed.data.species,
        breed: parsed.data.breed ?? null,
        sex: parsed.data.sex,
        birth_date: parsed.data.birthDate ?? null,
        color: parsed.data.color ?? null,
        microchip: parsed.data.microchip ?? null,
        is_neutered: parsed.data.isNeutered,
        is_deceased: parsed.data.isDeceased,
        deceased_at: parsed.data.deceasedAt ?? null,
        notes: parsed.data.notes ?? null,
        is_active: parsed.data.isActive,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un paciente con ese microchip' };
      }
      return { success: false, error: 'No se pudo crear el paciente' };
    }

    revalidatePath('/pacientes');
    redirect(`/pacientes/${data.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePatient(
  patientId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('patients:write');
    const parsed = parsePatientForm(formData);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('patients')
      .update({
        branch_id: parsed.data.branchId || null,
        owner_id: parsed.data.ownerId,
        name: parsed.data.name,
        species: parsed.data.species,
        breed: parsed.data.breed ?? null,
        sex: parsed.data.sex,
        birth_date: parsed.data.birthDate ?? null,
        color: parsed.data.color ?? null,
        microchip: parsed.data.microchip ?? null,
        is_neutered: parsed.data.isNeutered,
        is_deceased: parsed.data.isDeceased,
        deceased_at: parsed.data.deceasedAt ?? null,
        notes: parsed.data.notes ?? null,
        is_active: parsed.data.isActive,
      })
      .eq('id', patientId);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un paciente con ese microchip' };
      }
      return { success: false, error: 'No se pudo actualizar el paciente' };
    }

    revalidatePath('/pacientes');
    revalidatePath(`/pacientes/${patientId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deletePatient(patientId: string): Promise<ActionResult> {
  try {
    await requirePermission('patients:write');
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', patientId);

    if (error) {
      return { success: false, error: 'No se pudo eliminar el paciente' };
    }

    revalidatePath('/pacientes');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function countActivePatients(): Promise<number> {
  await requirePermission('patients:read');
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('is_active', true)
    .eq('is_deceased', false);

  if (error) return 0;
  return count ?? 0;
}

export async function canManagePatients(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('patients:write');
}

export async function canReadPatients(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('patients:read');
}

export async function searchPatientsForSelect(
  search: string,
  limit = 10
): Promise<
  Array<{
    id: string;
    name: string;
    species: string;
    owner_id: string;
    owner_full_name: string;
  }>
> {
  await requirePermission('patients:read');
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_patients', {
    p_search: search.trim() || null,
    p_branch_id: null,
    p_page: 1,
    p_page_size: limit,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    species: row.species,
    owner_id: row.owner_id,
    owner_full_name: row.owner_full_name,
  }));
}
