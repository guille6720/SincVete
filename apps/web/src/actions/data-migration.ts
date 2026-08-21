'use server';

import { revalidatePath } from 'next/cache';
import {
  DEFAULT_IMPORT_CHUNK_SIZE,
  buildClinicalTemplateCsv,
  buildLabOrderTemplateCsv,
  buildOwnerTemplateCsv,
  buildPatientTemplateCsv,
  buildPrescriptionTemplateCsv,
  buildSurgeryTemplateCsv,
  buildVaccinationTemplateCsv,
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
import { buildSampleMigrationZip, parseSyncveteMigrationZip, summarizeZipContents } from '@/lib/data-migration/zip';
import { workbookFirstSheetToCsv } from '@/lib/data-migration/xlsx';
import { importZipAttachmentsChunk } from '@/lib/data-migration/attachments';
import { createServerClient } from '@/lib/supabase/server';

const IMPORT_ENTITIES = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'lab_orders',
  'surgeries',
  'prescriptions',
] as const;
type ImportEntityArg = (typeof IMPORT_ENTITIES)[number];

function asImportEntity(value: string): ImportEntityArg | null {
  return (IMPORT_ENTITIES as readonly string[]).includes(value)
    ? (value as ImportEntityArg)
    : null;
}

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
    if (kind === 'vaccinations') {
      return {
        success: true,
        data: {
          filename: 'SyncVete-Vaccinations-Template.csv',
          csv: buildVaccinationTemplateCsv(),
        },
      };
    }
    if (kind === 'lab_orders') {
      return {
        success: true,
        data: { filename: 'SyncVete-Lab-Orders-Template.csv', csv: buildLabOrderTemplateCsv() },
      };
    }
    if (kind === 'surgeries') {
      return {
        success: true,
        data: { filename: 'SyncVete-Surgeries-Template.csv', csv: buildSurgeryTemplateCsv() },
      };
    }
    if (kind === 'prescriptions') {
      return {
        success: true,
        data: {
          filename: 'SyncVete-Prescriptions-Template.csv',
          csv: buildPrescriptionTemplateCsv(),
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
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
    const csvText = String(formData.get('csvText') ?? '');
    const sourceFilename = String(formData.get('sourceFilename') ?? 'upload.csv');
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    if (!importType || !csvText) return { success: false, error: 'Datos de importación incompletos' };
    if (!entity) return { success: false, error: 'Entidad inválida' };

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
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
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
    if (!entity) return { success: false, error: 'Entidad inválida' };
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
  ActionResult<{
    imported: number;
    failed: number;
    status: string;
    idMap: Record<string, string>;
    done: boolean;
    nextOffset: number;
    processed: number;
    total: number;
  }>
> {
  try {
    const session = await requirePermission('data:import');
    const batchId = String(formData.get('batchId') ?? '');
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
    const csvText = String(formData.get('csvText') ?? '');
    const mapping = JSON.parse(String(formData.get('mapping') ?? '{}')) as Record<
      string,
      string | null
    >;
    if (!entity) return { success: false, error: 'Entidad inválida' };
    const ownerIdByExternal = JSON.parse(
      String(formData.get('ownerIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const patientIdByExternal = JSON.parse(
      String(formData.get('patientIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    const offset = Number(formData.get('offset') ?? 0) || 0;
    const chunkSize =
      Number(formData.get('chunkSize') ?? DEFAULT_IMPORT_CHUNK_SIZE) || DEFAULT_IMPORT_CHUNK_SIZE;

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
      offset,
      chunkSize,
    });
    revalidatePath('/configuracion');
    revalidatePath('/propietarios');
    revalidatePath('/pacientes');
    revalidatePath('/historia-clinica');
    revalidatePath('/vacunacion');
    revalidatePath('/laboratorio');
    revalidatePath('/cirugias');
    revalidatePath('/farmacia');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function importZipAttachmentsAction(formData: FormData): Promise<
  ActionResult<{
    imported: number;
    failed: number;
    total: number;
    processed: number;
    done: boolean;
    nextOffset: number;
    status: string;
  }>
> {
  try {
    const session = await requirePermission('data:import');
    const batchId = String(formData.get('batchId') ?? '');
    const zipBase64 = String(formData.get('zipBase64') ?? '');
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    const patientIdByExternal = JSON.parse(
      String(formData.get('patientIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const offset = Number(formData.get('offset') ?? 0) || 0;
    const chunkSize = Number(formData.get('chunkSize') ?? 10) || 10;
    if (!batchId || !zipBase64) return { success: false, error: 'Datos de adjuntos incompletos' };

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

    const buffer = Buffer.from(zipBase64, 'base64');
    const result = await importZipAttachmentsChunk({
      batchId,
      zipBuffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      patientIdByExternal,
      branchId: branch.id,
      sourceSystem,
      offset,
      chunkSize,
    });
    revalidatePath('/configuracion');
    revalidatePath('/imagenes');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function downloadSampleMigrationZipAction(): Promise<
  ActionResult<{ filename: string; contentType: string; base64: string }>
> {
  try {
    await requirePermission('data:import');
    const bytes = await buildSampleMigrationZip('VetLegacy');
    return {
      success: true,
      data: {
        filename: 'SyncVete-Migration-Package-Sample.zip',
        contentType: 'application/zip',
        base64: Buffer.from(bytes).toString('base64'),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function inspectMigrationZipAction(formData: FormData): Promise<
  ActionResult<{
    summary: Record<string, number | string | null>;
    ownersCsv: string | null;
    patientsCsv: string | null;
    clinicalCsv: string | null;
    vaccinationsCsv: string | null;
    labOrdersCsv: string | null;
    surgeriesCsv: string | null;
    prescriptionsCsv: string | null;
  }>
> {
  try {
    await requirePermission('data:import');
    const base64 = String(formData.get('zipBase64') ?? '');
    if (!base64) return { success: false, error: 'ZIP vacío' };
    const buffer = Buffer.from(base64, 'base64');
    const parsed = await parseSyncveteMigrationZip(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
    return {
      success: true,
      data: {
        summary: summarizeZipContents(parsed),
        ownersCsv: parsed.ownersCsv,
        patientsCsv: parsed.patientsCsv,
        clinicalCsv: parsed.clinicalCsv,
        vaccinationsCsv: parsed.vaccinationsCsv,
        labOrdersCsv: parsed.labOrdersCsv,
        surgeriesCsv: parsed.surgeriesCsv,
        prescriptionsCsv: parsed.prescriptionsCsv,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function convertSpreadsheetToCsvAction(formData: FormData): Promise<
  ActionResult<{ csv: string; filename: string }>
> {
  try {
    await requirePermission('data:import');
    const base64 = String(formData.get('fileBase64') ?? '');
    const filename = String(formData.get('filename') ?? 'upload.xlsx');
    if (!base64) return { success: false, error: 'Archivo vacío' };
    const buffer = Buffer.from(base64, 'base64');
    const csv = workbookFirstSheetToCsv(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
    return {
      success: true,
      data: {
        csv,
        filename: filename.replace(/\.(xlsx|xls)$/i, '.csv'),
      },
    };
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
