'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  prescriptionCreateSchema,
  prescriptionListSchema,
  type ActionResult,
  type PaginatedResult,
  type Prescription,
  type PrescriptionItem,
  type PrescriptionListRow,
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

function rpcErrorMessage(error: { message?: string }, fallback: string): string {
  const message = error.message?.trim();
  if (message && message.length > 0 && message.length < 200 && !message.includes('function')) {
    return message;
  }
  return fallback;
}

function toPrescriptionListRow(
  row: PrescriptionListRow & { total_count?: number }
): PrescriptionListRow {
  const { total_count: _total, ...entry } = row;
  void _total;
  return {
    ...entry,
    item_count: Number(entry.item_count ?? 0),
    deleted_at: entry.deleted_at ?? null,
  };
}

function parseItemsFromForm(formData: FormData) {
  const names = formData.getAll('medicationName').map(String);
  return names.map((medicationName, index) => ({
    medicationName,
    dose: formData.getAll('dose')[index],
    frequency: formData.getAll('frequency')[index],
    duration: formData.getAll('duration')[index],
    route: formData.getAll('route')[index] || 'oral',
    quantity: formData.getAll('quantity')[index] ?? 0,
    productId: formData.getAll('productId')[index],
    instructions: formData.getAll('instructions')[index],
  }));
}

export async function listActivePrescriptions(): Promise<PrescriptionListRow[]> {
  const session = await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('list_active_prescriptions', {
    p_branch_id: session.branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) => toPrescriptionListRow(row as PrescriptionListRow));
}

export async function listPrescriptions(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    patientId?: string;
    branchId?: string;
    status?: string;
  } = {}
): Promise<PaginatedResult<PrescriptionListRow>> {
  await requirePermission('clinical:read');
  const parsed = prescriptionListSchema.parse(input);
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_prescriptions', {
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
  const prescriptions = rows.map((row) =>
    toPrescriptionListRow(row as PrescriptionListRow & { total_count: number })
  );

  return buildPaginatedResult(prescriptions, Number(total), parsed.page, parsed.pageSize);
}

export async function getPrescription(id: string): Promise<{
  prescription: PrescriptionListRow;
  items: PrescriptionItem[];
} | null> {
  await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !prescription) return null;

  const [{ data: patient }, { data: owner }, profileResult, { data: items }] = await Promise.all([
    supabase.from('patients').select('name, species').eq('id', prescription.patient_id).single(),
    supabase.from('owners').select('full_name').eq('id', prescription.owner_id).single(),
    prescription.prescribed_by
      ? supabase.from('profiles').select('full_name').eq('id', prescription.prescribed_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
  ]);

  if (!patient || !owner) return null;

  return {
    prescription: {
      ...(prescription as Prescription),
      item_count: (items ?? []).length,
      patient_name: patient.name,
      patient_species: patient.species as PrescriptionListRow['patient_species'],
      owner_full_name: owner.full_name,
      prescribed_by_name: profileResult.data?.full_name ?? null,
    },
    items: (items ?? []).map((item) => ({
      ...item,
      quantity: Number(item.quantity ?? 0),
    })) as PrescriptionItem[],
  };
}

export async function createPrescription(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermission('clinical:write');
    const parsed = prescriptionCreateSchema.safeParse({
      patientId: formData.get('patientId'),
      ownerId: formData.get('ownerId'),
      branchId: formData.get('branchId'),
      consultationId: formData.get('consultationId'),
      notes: formData.get('notes'),
      items: parseItemsFromForm(formData),
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
    const { data, error } = await supabase.rpc('create_prescription', {
      p_patient_id: parsed.data.patientId,
      p_owner_id: parsed.data.ownerId,
      p_branch_id: branchId,
      p_items: parsed.data.items.map((item) => ({
        medication_name: item.medicationName,
        dose: item.dose,
        frequency: item.frequency,
        duration: item.duration ?? null,
        route: item.route,
        quantity: item.quantity,
        inventory_product_id: item.productId ?? null,
        instructions: item.instructions ?? null,
      })),
      p_consultation_id: parsed.data.consultationId ?? null,
      p_notes: parsed.data.notes ?? null,
    });

    if (error || !data) {
      return {
        success: false,
        error: rpcErrorMessage(error ?? {}, 'No se pudo crear la receta'),
      };
    }

    const result = data as { prescription_id?: string };
    if (!result.prescription_id) {
      return { success: false, error: 'No se pudo crear la receta' };
    }

    revalidatePath('/farmacia');
    revalidatePath('/dashboard');
    revalidatePath(`/pacientes/${parsed.data.patientId}`);
    redirect(`/farmacia/${result.prescription_id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function dispensePrescription(prescriptionId: string): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const supabase = await createServerClient();

    const { error } = await supabase.rpc('dispense_prescription', {
      p_prescription_id: prescriptionId,
    });

    if (error) {
      return { success: false, error: rpcErrorMessage(error, 'No se pudo dispensar la receta') };
    }

    revalidatePath('/farmacia');
    revalidatePath(`/farmacia/${prescriptionId}`);
    revalidatePath('/dashboard');
    revalidatePath('/inventario');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function voidPrescription(
  prescriptionId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const supabase = await createServerClient();

    const { error } = await supabase.rpc('void_prescription', {
      p_prescription_id: prescriptionId,
      p_reason: reason?.trim() || null,
    });

    if (error) {
      return { success: false, error: rpcErrorMessage(error, 'No se pudo anular la receta') };
    }

    revalidatePath('/farmacia');
    revalidatePath(`/farmacia/${prescriptionId}`);
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function searchPharmacyProducts(search: string): Promise<
  Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>
> {
  const session = await getSessionContext();
  if (!session?.permissions.includes('inventory:read')) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('search_inventory_products', {
    p_search: search.trim() || null,
    p_branch_id: session.branchId ?? null,
    p_category: null,
    p_low_stock: false,
    p_active_only: true,
    p_page: 1,
    p_page_size: 8,
  });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity ?? 0),
    unit: row.unit,
  }));
}

export async function canManagePharmacy(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:write');
}

export async function canReadPharmacy(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:read');
}
