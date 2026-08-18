'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  buildPaginatedResult,
  labOrderCreateSchema,
  labOrderListSchema,
  labResultsSchema,
  type ActionResult,
  type LabOrder,
  type LabOrderItem,
  type LabOrderListRow,
  type PaginatedResult,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requirePermission, requirePermissionAndFeature, canPermissionAndFeature } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';
import { LAB_ORDER_COLUMNS, LAB_ORDER_ITEM_COLUMNS } from '@/lib/db-columns';
import { FEATURES, planRestrictionResult } from '@/lib/entitlements';

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
  const planError = planRestrictionResult<T>(error);
  if (planError) return planError;
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function toLabOrderListRow(
  row: LabOrderListRow & { total_count?: number }
): LabOrderListRow {
  const { total_count: _total, ...entry } = row;
  void _total;
  return {
    ...entry,
    item_count: Number(entry.item_count ?? 0),
    deleted_at: entry.deleted_at ?? null,
  };
}

export async function listLabQueue(): Promise<LabOrderListRow[]> {
  await requirePermission('clinical:read');
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('list_lab_queue', {
    p_branch_id: session?.branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) => toLabOrderListRow(row as LabOrderListRow));
}

export async function listLabOrders(
  input: {
    page?: number;
    pageSize?: number;
    search?: string;
    patientId?: string;
    branchId?: string;
    status?: string;
  } = {}
): Promise<PaginatedResult<LabOrderListRow>> {
  await requirePermission('clinical:read');
  const parsed = labOrderListSchema.parse(input);
  const session = await getSessionContext();
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_lab_orders', {
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
  const orders = rows.map((row) =>
    toLabOrderListRow(row as LabOrderListRow & { total_count: number })
  );

  return buildPaginatedResult(orders, Number(total), parsed.page, parsed.pageSize);
}

export async function getLabOrder(id: string): Promise<{
  order: LabOrderListRow;
  items: LabOrderItem[];
} | null> {
  await requirePermission('clinical:read');
  const supabase = await createServerClient();

  const { data: order, error } = await supabase
    .from('lab_orders')
    .select(LAB_ORDER_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !order) return null;

  const [{ data: patient }, { data: owner }, profileResult, { data: items }] = await Promise.all([
    supabase.from('patients').select('name, species').eq('id', order.patient_id).single(),
    supabase.from('owners').select('full_name').eq('id', order.owner_id).single(),
    order.ordered_by
      ? supabase.from('profiles').select('full_name').eq('id', order.ordered_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('lab_order_items')
      .select(LAB_ORDER_ITEM_COLUMNS)
      .eq('lab_order_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
  ]);

  if (!patient || !owner) return null;

  return {
    order: {
      ...(order as LabOrder),
      item_count: (items ?? []).length,
      patient_name: patient.name,
      patient_species: patient.species as LabOrderListRow['patient_species'],
      owner_full_name: owner.full_name,
      ordered_by_name: profileResult.data?.full_name ?? null,
    },
    items: (items ?? []) as LabOrderItem[],
  };
}

export async function createLabOrder(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requirePermissionAndFeature('clinical:write', FEATURES.LABORATORY);
    const testsRaw = formData.getAll('tests').map(String).filter(Boolean);
    const customTests = String(formData.get('customTests') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const tests = [...testsRaw, ...customTests];

    const parsed = labOrderCreateSchema.safeParse({
      patientId: formData.get('patientId'),
      ownerId: formData.get('ownerId'),
      branchId: formData.get('branchId'),
      consultationId: formData.get('consultationId'),
      title: formData.get('title'),
      priority: formData.get('priority') || 'rutina',
      sampleType: formData.get('sampleType'),
      notes: formData.get('notes'),
      tests,
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
    const { data: order, error } = await supabase
      .from('lab_orders')
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId,
        patient_id: parsed.data.patientId,
        owner_id: parsed.data.ownerId,
        consultation_id: parsed.data.consultationId ?? null,
        ordered_by: session.userId,
        status: 'solicitada',
        priority: parsed.data.priority,
        sample_type: parsed.data.sampleType ?? null,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
      })
      .select('id')
      .single();

    if (error || !order) {
      return { success: false, error: 'No se pudo crear la orden' };
    }

    const { error: itemsError } = await supabase.from('lab_order_items').insert(
      parsed.data.tests.map((testName, index) => ({
        organization_id: session.organizationId,
        lab_order_id: order.id,
        test_name: testName,
        sort_order: index,
        flag: 'pendiente' as const,
      }))
    );

    if (itemsError) {
      return { success: false, error: 'No se pudieron guardar los estudios' };
    }

    revalidatePath('/laboratorio');
    revalidatePath(`/pacientes/${parsed.data.patientId}`);
    redirect(`/laboratorio/${order.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function startLabOrder(orderId: string): Promise<ActionResult> {
  try {
    await requirePermissionAndFeature('clinical:write', FEATURES.LABORATORY);
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('lab_orders')
      .update({
        status: 'en_proceso',
        collected_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'solicitada');

    if (error) {
      return { success: false, error: 'No se pudo iniciar el procesamiento' };
    }

    revalidatePath('/laboratorio');
    revalidatePath(`/laboratorio/${orderId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveLabResults(
  orderId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requirePermissionAndFeature('clinical:write', FEATURES.LABORATORY);

    const itemIds = formData.getAll('itemId').map(String);
    const items = itemIds.map((id, index) => ({
      id,
      resultValue: formData.get(`resultValue_${index}`),
      unit: formData.get(`unit_${index}`),
      referenceRange: formData.get(`referenceRange_${index}`),
      flag: formData.get(`flag_${index}`) || 'pendiente',
      notes: formData.get(`itemNotes_${index}`),
    }));

    const parsed = labResultsSchema.safeParse({
      interpretation: formData.get('interpretation'),
      notes: formData.get('notes'),
      items,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { error: orderError } = await supabase
      .from('lab_orders')
      .update({
        interpretation: parsed.data.interpretation ?? null,
        notes: parsed.data.notes ?? null,
        status: 'en_proceso',
      })
      .eq('id', orderId)
      .in('status', ['solicitada', 'en_proceso']);

    if (orderError) {
      return { success: false, error: 'No se pudo guardar la orden' };
    }

    for (const item of parsed.data.items) {
      const { error } = await supabase
        .from('lab_order_items')
        .update({
          result_value: item.resultValue ?? null,
          unit: item.unit ?? null,
          reference_range: item.referenceRange ?? null,
          flag: item.flag,
          notes: item.notes ?? null,
        })
        .eq('id', item.id)
        .eq('lab_order_id', orderId);

      if (error) {
        return { success: false, error: 'No se pudieron guardar los resultados' };
      }
    }

    revalidatePath('/laboratorio');
    revalidatePath(`/laboratorio/${orderId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function completeLabOrderAction(
  orderId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const saveResult = await saveLabResults(orderId, null, formData);
    if (!saveResult.success) return saveResult;

    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('complete_lab_order', {
      p_lab_order_id: orderId,
    });

    if (error) {
      return { success: false, error: error.message || 'No se pudo completar el laboratorio' };
    }

    const result = data as { lab_order_id?: string; clinical_entry_id?: string } | null;

    revalidatePath('/laboratorio');
    revalidatePath(`/laboratorio/${orderId}`);

    if (result?.clinical_entry_id) {
      revalidatePath(`/historia-clinica/${result.clinical_entry_id}`);
      revalidatePath('/historia-clinica');
    }

    redirect(`/laboratorio/${orderId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelLabOrder(orderId: string): Promise<ActionResult> {
  try {
    await requirePermissionAndFeature('clinical:write', FEATURES.LABORATORY);
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('lab_orders')
      .update({ status: 'cancelada' })
      .eq('id', orderId)
      .in('status', ['solicitada', 'en_proceso']);

    if (error) {
      return { success: false, error: 'No se pudo cancelar la orden' };
    }

    revalidatePath('/laboratorio');
    revalidatePath(`/laboratorio/${orderId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function canManageLab(): Promise<boolean> {
  return canPermissionAndFeature('clinical:write', FEATURES.LABORATORY);
}

export async function canReadLab(): Promise<boolean> {
  return canPermissionAndFeature('clinical:read', FEATURES.LABORATORY);
}
