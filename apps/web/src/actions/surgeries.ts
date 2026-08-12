'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  fromLocalDateTimeInput,
  surgeryListSchema,
  surgeryScheduleSchema,
  surgeryWorksheetSchema,
  type ActionResult,
  type PaginatedResult,
  type Surgery,
  type SurgeryListRow,
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

function toSurgeryListRow(row: SurgeryListRow & { total_count?: number }): SurgeryListRow {
  const { total_count: _total, ...entry } = row;
  void _total;
  return {
    ...entry,
    deleted_at: entry.deleted_at ?? null,
  };
}

function parseWorksheet(formData: FormData) {
  return surgeryWorksheetSchema.safeParse({
    diagnosis: formData.get('diagnosis'),
    anesthesia: formData.get('anesthesia'),
    asa: formData.get('asa'),
    preopNotes: formData.get('preopNotes'),
    intraopNotes: formData.get('intraopNotes'),
    postopNotes: formData.get('postopNotes'),
    complications: formData.get('complications'),
    notes: formData.get('notes'),
  });
}

function worksheetUpdate(data: {
  diagnosis?: string;
  anesthesia?: 'general' | 'sedacion' | 'local' | 'epidural' | 'otro';
  asa?: 'I' | 'II' | 'III' | 'IV' | 'V';
  preopNotes?: string;
  intraopNotes?: string;
  postopNotes?: string;
  complications?: string;
  notes?: string;
}) {
  return {
    diagnosis: data.diagnosis ?? null,
    anesthesia: data.anesthesia ?? null,
    asa: data.asa ?? null,
    preop_notes: data.preopNotes ?? null,
    intraop_notes: data.intraopNotes ?? null,
    postop_notes: data.postopNotes ?? null,
    complications: data.complications ?? null,
    notes: data.notes ?? null,
  };
}

export async function listSurgeryBoard(): Promise<SurgeryListRow[]> {
  await requirePermission('clinical:read');
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('list_surgery_board', {
    p_branch_id: session?.branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) => toSurgeryListRow(row as SurgeryListRow));
}

export async function listSurgeries(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    patientId?: string;
    branchId?: string;
    status?: string;
  } = {}
): Promise<PaginatedResult<SurgeryListRow>> {
  await requirePermission('clinical:read');
  const parsed = surgeryListSchema.parse(input);
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_surgeries', {
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
  const surgeries = rows.map((row) =>
    toSurgeryListRow(row as SurgeryListRow & { total_count: number })
  );

  return buildPaginatedResult(surgeries, Number(total), parsed.page, parsed.pageSize);
}

export async function getSurgery(id: string): Promise<SurgeryListRow | null> {
  await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data: surgery, error } = await supabase
    .from('surgeries')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !surgery) return null;

  const [{ data: patient }, { data: owner }, profileResult] = await Promise.all([
    supabase.from('patients').select('name, species').eq('id', surgery.patient_id).single(),
    supabase.from('owners').select('full_name').eq('id', surgery.owner_id).single(),
    surgery.surgeon_id
      ? supabase.from('profiles').select('full_name').eq('id', surgery.surgeon_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!patient || !owner) return null;

  return {
    ...(surgery as Surgery),
    patient_name: patient.name,
    patient_species: patient.species as SurgeryListRow['patient_species'],
    owner_full_name: owner.full_name,
    surgeon_name: profileResult.data?.full_name ?? null,
  };
}

export async function getActiveSurgeryByPatient(
  patientId: string
): Promise<{ id: string; status: SurgeryListRow['status'] } | null> {
  const session = await getSessionContext();
  if (!session || !session.permissions.includes('clinical:read')) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from('surgeries')
    .select('id, status')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .in('status', ['en_curso', 'recuperacion'])
    .maybeSingle();

  return data ?? null;
}

export async function scheduleSurgery(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('clinical:write');
    const scheduledAtRaw = String(formData.get('scheduledAt') ?? '');
    const scheduledAt = scheduledAtRaw.includes('T') && !scheduledAtRaw.includes('Z')
      ? fromLocalDateTimeInput(scheduledAtRaw)
      : scheduledAtRaw;

    const parsed = surgeryScheduleSchema.safeParse({
      patientId: formData.get('patientId'),
      ownerId: formData.get('ownerId'),
      branchId: formData.get('branchId'),
      consultationId: formData.get('consultationId'),
      appointmentId: formData.get('appointmentId'),
      procedureName: formData.get('procedureName'),
      scheduledAt,
      diagnosis: formData.get('diagnosis'),
      anesthesia: formData.get('anesthesia'),
      asa: formData.get('asa'),
      preopNotes: formData.get('preopNotes'),
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
      .from('surgeries')
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId,
        patient_id: parsed.data.patientId,
        owner_id: parsed.data.ownerId,
        consultation_id: parsed.data.consultationId ?? null,
        appointment_id: parsed.data.appointmentId ?? null,
        surgeon_id: session.userId,
        status: 'programada',
        scheduled_at: parsed.data.scheduledAt,
        procedure_name: parsed.data.procedureName,
        diagnosis: parsed.data.diagnosis ?? null,
        anesthesia: parsed.data.anesthesia ?? null,
        asa: parsed.data.asa ?? null,
        preop_notes: parsed.data.preopNotes ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: 'No se pudo programar la cirugía' };
    }

    revalidatePath('/cirugias');
    revalidatePath('/dashboard');
    revalidatePath(`/pacientes/${parsed.data.patientId}`);
    redirect(`/cirugias/${data.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function saveSurgeryWorksheet(
  surgeryId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = parseWorksheet(formData);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('surgeries')
      .update(worksheetUpdate(parsed.data))
      .eq('id', surgeryId)
      .in('status', ['programada', 'en_curso', 'recuperacion']);

    if (error) {
      return { success: false, error: 'No se pudo guardar la ficha quirúrgica' };
    }

    revalidatePath('/cirugias');
    revalidatePath(`/cirugias/${surgeryId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function startSurgery(surgeryId: string): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const supabase = await createServerClient();

    const { data: surgery } = await supabase
      .from('surgeries')
      .select('id, appointment_id, status')
      .eq('id', surgeryId)
      .is('deleted_at', null)
      .single();

    if (!surgery || surgery.status !== 'programada') {
      return { success: false, error: 'Solo se puede iniciar una cirugía programada' };
    }

    const { error } = await supabase
      .from('surgeries')
      .update({ status: 'en_curso', started_at: new Date().toISOString() })
      .eq('id', surgeryId)
      .eq('status', 'programada');

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'El paciente ya tiene una cirugía en curso' };
      }
      return { success: false, error: 'No se pudo iniciar la cirugía' };
    }

    if (surgery.appointment_id) {
      await supabase
        .from('appointments')
        .update({ status: 'en_curso' })
        .eq('id', surgery.appointment_id)
        .in('status', ['programada', 'confirmada']);
    }

    revalidatePath('/cirugias');
    revalidatePath(`/cirugias/${surgeryId}`);
    revalidatePath('/dashboard');
    revalidatePath('/agenda');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveSurgeryToRecovery(surgeryId: string): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('surgeries')
      .update({ status: 'recuperacion' })
      .eq('id', surgeryId)
      .eq('status', 'en_curso');

    if (error) {
      return { success: false, error: 'No se pudo pasar a recuperación' };
    }

    revalidatePath('/cirugias');
    revalidatePath(`/cirugias/${surgeryId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function completeSurgeryAction(
  surgeryId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = parseWorksheet(formData);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { error: draftError } = await supabase
      .from('surgeries')
      .update(worksheetUpdate(parsed.data))
      .eq('id', surgeryId)
      .in('status', ['en_curso', 'recuperacion']);

    if (draftError) {
      return { success: false, error: 'No se pudo guardar la ficha quirúrgica' };
    }

    const { data, error } = await supabase.rpc('complete_surgery', {
      p_surgery_id: surgeryId,
    });

    if (error) {
      return { success: false, error: error.message || 'No se pudo completar la cirugía' };
    }

    const result = data as { surgery_id?: string; clinical_entry_id?: string } | null;

    revalidatePath('/cirugias');
    revalidatePath(`/cirugias/${surgeryId}`);
    revalidatePath('/historia-clinica');
    revalidatePath('/dashboard');
    revalidatePath('/agenda');

    if (result?.clinical_entry_id) {
      revalidatePath(`/historia-clinica/${result.clinical_entry_id}`);
    }

    redirect(`/cirugias/${surgeryId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelSurgery(surgeryId: string): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('surgeries')
      .update({ status: 'cancelada' })
      .eq('id', surgeryId)
      .in('status', ['programada', 'en_curso']);

    if (error) {
      return { success: false, error: 'No se pudo cancelar la cirugía' };
    }

    revalidatePath('/cirugias');
    revalidatePath(`/cirugias/${surgeryId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function canManageSurgeries(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:write');
}

export async function canReadSurgeries(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:read');
}
