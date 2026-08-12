'use server';

import { revalidatePath } from 'next/cache';
import {
  buildClinicalAiUserPrompt,
  buildPaginatedResult,
  clinicalAiApplySoapSchema,
  clinicalAiExcerpt,
  clinicalAiGenerateSchema,
  clinicalAiListSchema,
  hashClinicalAiPrompt,
  parseClinicalAiOutput,
  parsePatientClinicalContext,
  type ActionResult,
  type ClinicalAiGenerateResult,
  type ClinicalAiKind,
  type ClinicalAiSoapSnapshot,
  type ClinicalAiSuggestionListRow,
  type PaginatedResult,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { PermissionError, requirePermission } from '@/lib/permissions';
import { getSessionContext } from '@/actions/auth';
import { getClinicalEntry } from '@/actions/clinical-entries';
import { getConsultation } from '@/actions/consultations';
import { ClinicalAiConfigError, completeClinicalAiJson, isClinicalAiConfigured } from '@/lib/ai/openai';
import type { Json } from '@sincvete/db';

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
  if (error instanceof PermissionError || error instanceof ClinicalAiConfigError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error && error.message && !error.message.includes('fetch')) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return { success: false, error: 'Ocurrió un error inesperado' };
}

function rpcMessage(error: { message?: string } | null): string {
  const message = error?.message ?? '';
  if (
    message.includes('permisos') ||
    message.includes('Paciente') ||
    message.includes('Tipo') ||
    message.includes('sugerencia')
  ) {
    return message;
  }
  return 'Ocurrió un error inesperado';
}

export async function canReadClinicalAi(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:read');
}

export async function canGenerateClinicalAi(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session) return false;
  return session.permissions.includes('clinical:write');
}

export async function getClinicalAiStatus(): Promise<{ configured: boolean; canGenerate: boolean }> {
  const canGenerate = await canGenerateClinicalAi();
  return { configured: isClinicalAiConfigured(), canGenerate };
}

export async function listClinicalAiSuggestions(
  input: { page?: number; pageSize?: number; patientId?: string; kind?: ClinicalAiKind } = {}
): Promise<PaginatedResult<ClinicalAiSuggestionListRow>> {
  await requirePermission('clinical:read');
  const parsed = clinicalAiListSchema.parse(input);
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('search_ai_suggestions', {
    p_patient_id: parsed.patientId ?? null,
    p_kind: parsed.kind ?? null,
    p_page: parsed.page,
    p_page_size: parsed.pageSize,
  });

  if (error) throw error;

  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const suggestions = rows.map((row) => {
    const { total_count: _total, ...suggestion } = row;
    void _total;
    return suggestion as ClinicalAiSuggestionListRow;
  });

  return buildPaginatedResult(suggestions, Number(total), parsed.page, parsed.pageSize);
}

export async function generateClinicalAi(
  _prev: ActionResult<ClinicalAiGenerateResult> | null,
  formData: FormData
): Promise<ActionResult<ClinicalAiGenerateResult>> {
  try {
    const session = await requirePermission('clinical:write');
    const parsed = clinicalAiGenerateSchema.safeParse({
      patientId: formData.get('patientId'),
      kind: formData.get('kind'),
      notes: formData.get('notes') || undefined,
      consultationId: formData.get('consultationId') || undefined,
      clinicalEntryId: formData.get('clinicalEntryId') || undefined,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Datos inválidos',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const supabase = await createServerClient();
    const { data: contextRaw, error: contextError } = await supabase.rpc(
      'get_patient_clinical_context',
      { p_patient_id: parsed.data.patientId }
    );

    if (contextError) {
      return { success: false, error: rpcMessage(contextError) };
    }

    const context = parsePatientClinicalContext(contextRaw);
    if (!context?.patient) {
      return { success: false, error: 'Paciente no encontrado' };
    }

    let snapshot: ClinicalAiSoapSnapshot | null = null;
    if (parsed.data.consultationId) {
      const consultation = await getConsultation(parsed.data.consultationId);
      if (!consultation || consultation.patient_id !== parsed.data.patientId) {
        return { success: false, error: 'Consulta no encontrada' };
      }
      snapshot = {
        title: consultation.title,
        anamnesis: consultation.anamnesis,
        physicalExam: consultation.physical_exam,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        plan: consultation.plan,
        notes: consultation.notes,
        weightKg: consultation.weight_kg,
        temperatureC: consultation.temperature_c,
      };
    } else if (parsed.data.clinicalEntryId) {
      const entry = await getClinicalEntry(parsed.data.clinicalEntryId);
      if (!entry || entry.patient_id !== parsed.data.patientId) {
        return { success: false, error: 'Entrada clínica no encontrada' };
      }
      snapshot = {
        title: entry.title,
        anamnesis: entry.anamnesis,
        physicalExam: entry.physical_exam,
        diagnosis: entry.diagnosis,
        treatment: entry.treatment,
        plan: entry.plan,
        notes: entry.notes,
        weightKg: entry.weight_kg,
        temperatureC: entry.temperature_c,
      };
    }

    const prompt = buildClinicalAiUserPrompt({
      kind: parsed.data.kind,
      context,
      snapshot,
      notes: parsed.data.notes,
    });
    const completion = await completeClinicalAiJson(prompt.system, prompt.user);
    const output = parseClinicalAiOutput(parsed.data.kind, completion.text);
    if (!output) {
      return { success: false, error: 'La IA devolvió un formato inválido. Probá de nuevo.' };
    }

    const { data, error } = await supabase.rpc('save_ai_suggestion', {
      p_patient_id: parsed.data.patientId,
      p_kind: parsed.data.kind,
      p_prompt_hash: hashClinicalAiPrompt(`${prompt.system}\n${prompt.user}`),
      p_output: output as unknown as Json,
      p_model: completion.model.slice(0, 80),
      p_input_excerpt: clinicalAiExcerpt(prompt.user),
      p_consultation_id: parsed.data.consultationId ?? null,
      p_clinical_entry_id: parsed.data.clinicalEntryId ?? null,
      p_branch_id: session.branchId,
    });

    if (error) {
      return { success: false, error: rpcMessage(error) };
    }

    const payload = data as { id?: string } | null;
    if (!payload?.id) {
      return { success: false, error: 'No se pudo guardar la sugerencia' };
    }

    revalidatePath('/ia-clinica');
    if (parsed.data.consultationId) {
      revalidatePath(`/consultas/${parsed.data.consultationId}`);
    }
    revalidatePath(`/pacientes/${parsed.data.patientId}`);

    return {
      success: true,
      data: {
        id: payload.id,
        kind: parsed.data.kind,
        output,
        model: completion.model,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function applySoapSuggestion(input: {
  consultationId: string;
  diagnosis: string;
  treatment: string;
  plan: string;
}): Promise<ActionResult> {
  try {
    await requirePermission('clinical:write');
    const parsed = clinicalAiApplySoapSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('consultations')
      .update({
        diagnosis: parsed.data.diagnosis,
        treatment: parsed.data.treatment,
        plan: parsed.data.plan,
      })
      .eq('id', parsed.data.consultationId)
      .in('status', ['en_espera', 'en_curso'])
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: 'No se pudo aplicar la sugerencia a la consulta' };
    }

    revalidatePath('/consultas');
    revalidatePath(`/consultas/${parsed.data.consultationId}`);
    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}
