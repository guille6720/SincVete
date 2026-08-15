'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  hospitalizationAdmitSchema,
  hospitalizationDischargeSchema,
  hospitalizationListSchema,
  hospitalizationNoteSchema,
  hospitalizationUpdateSchema,
  type ActionResult,
  type Hospitalization,
  type HospitalizationListRow,
  type HospitalizationNote,
  type PaginatedResult,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';
import { HOSPITALIZATION_COLUMNS, HOSPITALIZATION_NOTE_COLUMNS } from '@/lib/db-columns';

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

function toHospitalizationListRow(
  row: HospitalizationListRow & { total_count?: number }
): HospitalizationListRow {
  const { total_count: _total, ...entry } = row;
  void _total;
  return {
    ...entry,
    deleted_at: entry.deleted_at ?? null,
  };
}

function toHospitalizationNote(
  row: HospitalizationNote & { recorded_by_name?: string | null }
): HospitalizationNote {
  return {
    ...row,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    temperature_c: row.temperature_c != null ? Number(row.temperature_c) : null,
    recorded_by_name: row.recorded_by_name ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

export async function listActiveHospitalizations(): Promise<HospitalizationListRow[]> {
  await requirePermission('clinical:read');
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('list_active_hospitalizations', {
    p_branch_id: session?.branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) =>
    toHospitalizationListRow(row as HospitalizationListRow)
  );
}

export async function listHospitalizations(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    patientId?: string;
    branchId?: string;
    status?: string;
  } = {}
): Promise<PaginatedResult<HospitalizationListRow>> {
  await requirePermission('clinical:read');
  const parsed = hospitalizationListSchema.parse(input);
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_hospitalizations', {
    p_search: parsed.search?.trim() || null,
    p_patient_id: parsed.patientId || null,
    p_branch_id: parsed.branchId ?? session?.branchId ?? null,
    p_status: parsed.status || null,
    p_page: parsed.page,
    p_page_size: parsed.pageSize,
  });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const hospitalizations = rows.map((row) =>
    toHospitalizationListRow(row as HospitalizationListRow & { total_count: number })
  );

  return buildPaginatedResult(hospitalizations, Number(total), parsed.page, parsed.pageSize);
}

export async function getHospitalization(id: string): Promise<{
  stay: HospitalizationListRow;
  notes: HospitalizationNote[];
} | null> {
  await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data: stay, error } = await supabase
    .from('hospitalizations')
    .select(HOSPITALIZATION_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !stay) return null;

  const [{ data: patient }, { data: owner }, profileResult, { data: notes }] = await Promise.all([
    supabase.from('patients').select('name, species').eq('id', stay.patient_id).single(),
    supabase.from('owners').select('full_name').eq('id', stay.owner_id).single(),
    stay.veterinarian_id
      ? supabase.from('profiles').select('full_name').eq('id', stay.veterinarian_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('hospitalization_notes')
      .select(HOSPITALIZATION_NOTE_COLUMNS)
      .eq('hospitalization_id', id)
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false }),
  ]);

  if (!patient || !owner) return null;

  const recorderIds = [...new Set((notes ?? []).map((note) => note.recorded_by).filter(Boolean))] as string[];
  const recorderNames = new Map<string, string>();

  if (recorderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', recorderIds);
    for (const profile of profiles ?? []) {
      recorderNames.set(profile.id, profile.full_name);
    }
  }

  return {
    stay: {
      ...(stay as Hospitalization),
      patient_name: patient.name,
      patient_species: patient.species as HospitalizationListRow['patient_species'],
      owner_full_name: owner.full_name,
      veterinarian_name: profileResult.data?.full_name ?? null,
    },
    notes: (notes ?? []).map((note) =>
      toHospitalizationNote({
        ...(note as HospitalizationNote),
        recorded_by_name: note.recorded_by ? recorderNames.get(note.recorded_by) ?? null : null,
      })
    ),
  };
}

export async function getActiveHospitalizationByPatient(
  patientId: string
): Promise<{ id: string; status: HospitalizationListRow['status'] } | null> {
  const session = await getSessionContext();
  if (!session || !session.permissions.includes('clinical:read')) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('hospitalizations')
    .select('id, status')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .in('status', ['internado', 'observacion'])
    .maybeSingle();

  return data ?? null;
}

export async function admitHospitalization(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('clinical:write');
    const parsed = hospitalizationAdmitSchema.safeParse({
      patientId: formData.get('patientId'),
      ownerId: formData.get('ownerId'),
      branchId: formData.get('branchId'),
      consultationId: formData.get('consultationId'),
      status: formData.get('status') || 'internado',
      cage: formData.get('cage'),
      reason: formData.get('reason'),
      diagnosis: formData.get('diagnosis'),
      treatmentPlan: formData.get('treatmentPlan'),
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
    const { data, error } = await supabase
      .from('hospitalizations')
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId,
        patient_id: parsed.data.patientId,
        owner_id: parsed.data.ownerId,
        consultation_id: parsed.data.consultationId ?? null,
        veterinarian_id: session.userId,
        status: parsed.data.status,
        cage: parsed.data.cage ?? null,
        reason: parsed.data.reason,
        diagnosis: parsed.data.diagnosis ?? null,
        treatment_plan: parsed.data.treatmentPlan ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'El paciente ya tiene una internación activa' };
      }
      return { success: false, error: 'No se pudo internar al paciente' };
    }

    revalidatePath('/internacion');
    revalidatePath(`/pacientes/${parsed.data.patientId}`);
    redirect(`/internacion/${data.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateHospitalization(
  hospitalizationId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = hospitalizationUpdateSchema.safeParse({
      status: formData.get('status'),
      cage: formData.get('cage'),
      reason: formData.get('reason'),
      diagnosis: formData.get('diagnosis'),
      treatmentPlan: formData.get('treatmentPlan'),
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
      .from('hospitalizations')
      .update({
        status: parsed.data.status,
        cage: parsed.data.cage ?? null,
        reason: parsed.data.reason,
        diagnosis: parsed.data.diagnosis ?? null,
        treatment_plan: parsed.data.treatmentPlan ?? null,
        notes: parsed.data.notes ?? null,
      })
      .eq('id', hospitalizationId)
      .in('status', ['internado', 'observacion']);

    if (error) {
      return { success: false, error: 'No se pudo actualizar la internación' };
    }

    revalidatePath('/internacion');
    revalidatePath(`/internacion/${hospitalizationId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function addHospitalizationNote(
  hospitalizationId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('clinical:write');
    const parsed = hospitalizationNoteSchema.safeParse({
      noteType: formData.get('noteType') || 'evolucion',
      content: formData.get('content'),
      weightKg: formData.get('weightKg'),
      temperatureC: formData.get('temperatureC'),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { data: stay } = await supabase
      .from('hospitalizations')
      .select('id, organization_id, status')
      .eq('id', hospitalizationId)
      .is('deleted_at', null)
      .single();

    if (!stay || (stay.status !== 'internado' && stay.status !== 'observacion')) {
      return { success: false, error: 'La internación no está activa' };
    }

    const { error } = await supabase.from('hospitalization_notes').insert({
      organization_id: stay.organization_id,
      hospitalization_id: hospitalizationId,
      recorded_by: session.userId,
      note_type: parsed.data.noteType,
      content: parsed.data.content,
      weight_kg: parsed.data.weightKg ?? null,
      temperature_c: parsed.data.temperatureC ?? null,
    });

    if (error) {
      return { success: false, error: 'No se pudo guardar la evolución' };
    }

    revalidatePath('/internacion');
    revalidatePath(`/internacion/${hospitalizationId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function dischargeHospitalizationAction(
  hospitalizationId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = hospitalizationDischargeSchema.safeParse({
      outcome: formData.get('outcome'),
      summary: formData.get('summary'),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { data: stay } = await supabase
      .from('hospitalizations')
      .select('patient_id')
      .eq('id', hospitalizationId)
      .single();

    const { data, error } = await supabase.rpc('discharge_hospitalization', {
      p_hospitalization_id: hospitalizationId,
      p_outcome: parsed.data.outcome,
      p_summary: parsed.data.summary ?? null,
    });

    if (error) {
      return { success: false, error: error.message || 'No se pudo dar el alta' };
    }

    const result = data as { hospitalization_id?: string; clinical_entry_id?: string } | null;

    revalidatePath('/internacion');
    revalidatePath(`/internacion/${hospitalizationId}`);
    if (stay?.patient_id) {
      revalidatePath(`/pacientes/${stay.patient_id}`);
      revalidatePath(`/pacientes/${stay.patient_id}/historia`);
    }

    if (result?.clinical_entry_id) {
      revalidatePath(`/historia-clinica/${result.clinical_entry_id}`);
      revalidatePath('/historia-clinica');
    }

    redirect(`/internacion/${hospitalizationId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function canManageHospitalizations(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:write');
}

export async function canReadHospitalizations(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:read');
}
