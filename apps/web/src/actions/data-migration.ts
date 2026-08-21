'use server';

import { revalidatePath } from 'next/cache';
import {
  buildClinicalTemplateCsv,
  buildOwnerTemplateCsv,
  buildPatientTemplateCsv,
  IMPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  type ActionResult,
  type ExportFormat,
  type ExportType,
  type ImportType,
} from '@sincvete/shared';
import { PermissionError, requirePermission } from '@/lib/permissions';
import {
  analyzeImportFile,
  commitImport,
  createImportBatch,
  dryRunImport,
  getImportBatch,
  listImportBatches,
  rollbackImportBatch,
} from '@/lib/data-migration/import';
import { createExportJob, listExportJobs, runExportJob } from '@/lib/data-migration/export';
import { createServerClient } from '@/lib/supabase/server';

function actionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Ocurrió un error inesperado',
  };
}

function asImportType(value: string): ImportType | null {
  return (IMPORT_TYPES as readonly string[]).includes(value) ? (value as ImportType) : null;
}

function asExportType(value: string): ExportType | null {
  return (EXPORT_TYPES as readonly string[]).includes(value) ? (value as ExportType) : null;
}

function asExportFormat(value: string): ExportFormat | null {
  return (EXPORT_FORMATS as readonly string[]).includes(value) ? (value as ExportFormat) : null;
}

export async function downloadImportTemplate(
  formData: FormData
): Promise<ActionResult<{ filename: string; csv: string }>> {
  try {
    await requirePermission('data:import');
    const kind = String(formData.get('kind') ?? '');
    if (kind === 'owners') {
      return {
        success: true,
        data: { filename: 'SyncVete-Owners-Template.csv', csv: buildOwnerTemplateCsv() },
      };
    }
    if (kind === 'patients') {
      return {
        success: true,
        data: { filename: 'SyncVete-Patients-Template.csv', csv: buildPatientTemplateCsv() },
      };
    }
    if (kind === 'clinical_entries') {
      return {
        success: true,
        data: {
          filename: 'SyncVete-Clinical-History-Template.csv',
          csv: buildClinicalTemplateCsv(),
        },
      };
    }
    return { success: false, error: 'Plantilla inválida' };
  } catch (error) {
    return actionError(error);
  }
}

export async function startDataImport(formData: FormData): Promise<
  ActionResult<{
    batchId: string;
    headers: string[];
    mapping: Record<string, string | null>;
    rowCount: number;
  }>
> {
  try {
    const session = await requirePermission('data:import');
    const importType = asImportType(String(formData.get('importType') ?? ''));
    const entity = String(formData.get('entity') ?? '') as
      | 'owners'
      | 'patients'
      | 'clinical_entries';
    const csvText = String(formData.get('csvText') ?? '');
    const sourceFilename = String(formData.get('sourceFilename') ?? 'upload.csv');
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    if (!importType || !csvText) return { success: false, error: 'Datos de importación incompletos' };
    if (!['owners', 'patients', 'clinical_entries'].includes(entity)) {
      return { success: false, error: 'Entidad inválida' };
    }

    const batch = await createImportBatch({
      importType,
      sourceFilename,
      sourceFormat: 'csv',
      sourceSystem,
    });
    const analyzed = await analyzeImportFile({
      batchId: batch.id,
      csvText,
      entity,
    });

    // Ensure a default branch exists for inserts
    const supabase = await createServerClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!branch) return { success: false, error: 'La clínica no tiene sucursal activa' };

    return {
      success: true,
      data: {
        batchId: batch.id,
        headers: analyzed.headers,
        mapping: analyzed.mapping,
        rowCount: analyzed.rows.length,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function validateDataImport(formData: FormData): Promise<
  ActionResult<{
    detected: number;
    ready: number;
    warnings: number;
    errors: number;
    issues: unknown[];
  }>
> {
  try {
    await requirePermission('data:import');
    const batchId = String(formData.get('batchId') ?? '');
    const entity = String(formData.get('entity') ?? '') as
      | 'owners'
      | 'patients'
      | 'clinical_entries';
    const csvText = String(formData.get('csvText') ?? '');
    const mappingJson = String(formData.get('mapping') ?? '{}');
    const knownOwners = String(formData.get('knownOwnerExternalIds') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const knownPatients = String(formData.get('knownPatientExternalIds') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const mapping = JSON.parse(mappingJson) as Record<string, string | null>;
    const result = await dryRunImport({
      batchId,
      csvText,
      entity,
      mapping,
      knownOwnerExternalIds: knownOwners,
      knownPatientExternalIds: knownPatients,
    });
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function commitDataImport(formData: FormData): Promise<
  ActionResult<{ imported: number; failed: number; status: string; idMap: Record<string, string> }>
> {
  try {
    const session = await requirePermission('data:import');
    const batchId = String(formData.get('batchId') ?? '');
    const entity = String(formData.get('entity') ?? '') as
      | 'owners'
      | 'patients'
      | 'clinical_entries';
    const csvText = String(formData.get('csvText') ?? '');
    const mapping = JSON.parse(String(formData.get('mapping') ?? '{}')) as Record<
      string,
      string | null
    >;
    const ownerIdByExternal = JSON.parse(
      String(formData.get('ownerIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const patientIdByExternal = JSON.parse(
      String(formData.get('patientIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;

    const supabase = await createServerClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!branch) return { success: false, error: 'La clínica no tiene sucursal activa' };

    const result = await commitImport({
      batchId,
      csvText,
      entity,
      mapping,
      sourceSystem,
      ownerIdByExternal,
      patientIdByExternal,
      branchId: branch.id,
    });
    revalidatePath('/configuracion');
    revalidatePath('/propietarios');
    revalidatePath('/pacientes');
    revalidatePath('/historia-clinica');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function listDataImportBatchesAction() {
  try {
    await requirePermission('data:import');
    return { success: true as const, data: await listImportBatches() };
  } catch (error) {
    return actionError(error);
  }
}

export async function getDataImportBatchAction(batchId: string) {
  try {
    await requirePermission('data:import');
    return { success: true as const, data: await getImportBatch(batchId) };
  } catch (error) {
    return actionError(error);
  }
}

export async function rollbackDataImportAction(
  formData: FormData
): Promise<ActionResult<{ rolledBack: number }>> {
  try {
    await requirePermission('data:import');
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const result = await rollbackImportBatch(batchId);
    revalidatePath('/configuracion');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function listDataExportJobsAction() {
  try {
    await requirePermission('data:export');
    return { success: true as const, data: await listExportJobs() };
  } catch (error) {
    return actionError(error);
  }
}

export async function runClinicExportAction(formData: FormData): Promise<
  ActionResult<{
    filename: string;
    contentType: string;
    base64: string;
    recordCounts: Record<string, number>;
  }>
> {
  try {
    await requirePermission('data:export');
    const exportType = asExportType(String(formData.get('exportType') ?? ''));
    const format = asExportFormat(String(formData.get('format') ?? ''));
    const patientId = String(formData.get('patientId') ?? '').trim() || null;
    if (!exportType || !format) return { success: false, error: 'Exportación inválida' };
    if (format === 'xlsx') {
      return {
        success: false,
        error: 'Usá CSV (compatible con Excel) o JSON/ZIP. XLSX nativo llega en una fase siguiente.',
      };
    }

    const job = await createExportJob({ exportType, format, patientId });
    const result = await runExportJob(job.id);
    const base64 =
      typeof result.body === 'string'
        ? Buffer.from(result.body, 'utf8').toString('base64')
        : Buffer.from(result.body).toString('base64');

    revalidatePath('/configuracion');
    return {
      success: true,
      data: {
        filename: result.filename,
        contentType: result.contentType,
        base64,
        recordCounts: result.recordCounts,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}
