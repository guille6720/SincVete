'use server';

import { revalidatePath } from 'next/cache';
import {
  DEFAULT_IMPORT_CHUNK_SIZE,
  IDEMPOTENCY_MODES,
  buildBatchErrorsReportCsv,
  buildClinicalTemplateCsv,
  buildHospitalizationTemplateCsv,
  buildLabOrderTemplateCsv,
  buildOwnerTemplateCsv,
  buildPatientTemplateCsv,
  buildPrescriptionTemplateCsv,
  buildSurgeryTemplateCsv,
  buildVaccinationTemplateCsv,
  buildValidationReportCsv,
  unresolvedConflictRows,
  IMPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  type ActionResult,
  type ExportFormat,
  type ExportType,
  type IdempotencyMode,
  type ImportType,
  type RowConflictDecision,
  type ValidationIssue,
} from '@sincvete/shared';
import { PermissionError, requirePermissionAndFeature, canPermissionAndFeature, requireSuperadmin } from '@/lib/permissions';
import { FEATURES, planRestrictionResult } from '@/lib/entitlements';
import { logDataMigrationAudit } from '@/lib/data-migration/audit';
import {
  analyzeImportFile,
  commitImport,
  createImportBatch,
  dryRunImport,
  getImportBatch,
  listImportBatches,
  queueImportBatch,
  rollbackImportBatch,
  saveRowDecisions,
} from '@/lib/data-migration/import';
import { createExportJob, getExportDownloadUrl, getImportBatchProgress, listExportJobs, runExportJob } from '@/lib/data-migration/export';
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
  'hospitalizations',
] as const;
type ImportEntityArg = (typeof IMPORT_ENTITIES)[number];

function asImportEntity(value: string): ImportEntityArg | null {
  return (IMPORT_ENTITIES as readonly string[]).includes(value)
    ? (value as ImportEntityArg)
    : null;
}

function actionError<T = void>(error: unknown): ActionResult<T> {
  const planError = planRestrictionResult<T>(error);
  if (planError) return planError;
  if (error instanceof PermissionError) {
    return { success: false, error: error.message };
  }
  console.error(error);
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Ocurrió un error inesperado',
  };
}

async function requireImportAccess() {
  return requirePermissionAndFeature('data:import', FEATURES.DATA_IMPORT_EXPORT);
}

async function requireExportAccess() {
  return requirePermissionAndFeature('data:export', FEATURES.DATA_IMPORT_EXPORT);
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
    await requireImportAccess();
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
    if (kind === 'hospitalizations') {
      return {
        success: true,
        data: {
          filename: 'SyncVete-Hospitalizations-Template.csv',
          csv: buildHospitalizationTemplateCsv(),
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
    const session = await requireImportAccess();
    const importType = asImportType(String(formData.get('importType') ?? ''));
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
    const csvText = String(formData.get('csvText') ?? '');
    const sourceFilename = String(formData.get('sourceFilename') ?? 'upload.csv');
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    const idempotencyRaw = String(formData.get('idempotencyMode') ?? 'off');
    const idempotencyMode = (IDEMPOTENCY_MODES as readonly string[]).includes(idempotencyRaw)
      ? (idempotencyRaw as IdempotencyMode)
      : 'off';
    if (!importType || !csvText) return { success: false, error: 'Datos de importación incompletos' };
    if (!entity) return { success: false, error: 'Entidad inválida' };

    const batch = await createImportBatch({
      importType,
      sourceFilename,
      sourceFormat: 'csv',
      sourceSystem,
      idempotencyMode,
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
    await requireImportAccess();
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
    const session = await requireImportAccess();
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
    const rowDecisions = JSON.parse(
      String(formData.get('rowDecisions') ?? '{}')
    ) as Record<number, RowConflictDecision>;
    const validationIssues = JSON.parse(
      String(formData.get('validationIssues') ?? '[]')
    ) as ValidationIssue[];

    const unresolved = unresolvedConflictRows(validationIssues, rowDecisions);
    if (unresolved.length > 0) {
      return {
        success: false,
        error: `Hay ${unresolved.length} filas con duplicados sin decisión (crear/vincular/omitir)`,
      };
    }

    if (Object.keys(rowDecisions).length > 0) {
      await saveRowDecisions({
        batchId,
        entityType: entity,
        decisions: Object.values(rowDecisions),
      });
    }

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
      rowDecisions,
    });
    revalidatePath('/configuracion');
    revalidatePath('/propietarios');
    revalidatePath('/pacientes');
    revalidatePath('/historia-clinica');
    revalidatePath('/vacunacion');
    revalidatePath('/laboratorio');
    revalidatePath('/cirugias');
    revalidatePath('/farmacia');
    revalidatePath('/internacion');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function queueDataImportAction(formData: FormData): Promise<
  ActionResult<{ batchId: string; storagePath: string; status: string }>
> {
  try {
    const session = await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
    const csvText = String(formData.get('csvText') ?? '');
    const mapping = JSON.parse(String(formData.get('mapping') ?? '{}')) as Record<
      string,
      string | null
    >;
    if (!entity || !batchId || !csvText) {
      return { success: false, error: 'Datos incompletos para encolar' };
    }
    const ownerIdByExternal = JSON.parse(
      String(formData.get('ownerIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const patientIdByExternal = JSON.parse(
      String(formData.get('patientIdByExternal') ?? '{}')
    ) as Record<string, string>;
    const sourceSystem = String(formData.get('sourceSystem') ?? '').trim() || null;
    const rowDecisions = JSON.parse(
      String(formData.get('rowDecisions') ?? '{}')
    ) as Record<number, RowConflictDecision>;
    const validationIssues = JSON.parse(
      String(formData.get('validationIssues') ?? '[]')
    ) as ValidationIssue[];
    const unresolved = unresolvedConflictRows(validationIssues, rowDecisions);
    if (unresolved.length > 0) {
      return {
        success: false,
        error: `Hay ${unresolved.length} filas con duplicados sin decisión`,
      };
    }

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

    const result = await queueImportBatch({
      batchId,
      csvText,
      entity,
      mapping,
      sourceSystem,
      ownerIdByExternal,
      patientIdByExternal,
      branchId: branch.id,
      rowDecisions,
    });
    revalidatePath('/configuracion');
    return { success: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveImportRowDecisionsAction(formData: FormData): Promise<
  ActionResult<{ saved: number }>
> {
  try {
    await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    const entity = asImportEntity(String(formData.get('entity') ?? ''));
    const decisions = JSON.parse(String(formData.get('rowDecisions') ?? '{}')) as Record<
      number,
      RowConflictDecision
    >;
    if (!batchId || !entity) return { success: false, error: 'Lote inválido' };
    const result = await saveRowDecisions({
      batchId,
      entityType: entity,
      decisions: Object.values(decisions),
    });
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
    const session = await requireImportAccess();
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
    await requireImportAccess();
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
    hospitalizationsCsv: string | null;
  }>
> {
  try {
    await requireImportAccess();
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
        hospitalizationsCsv: parsed.hospitalizationsCsv,
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
    await requireImportAccess();
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
    await requireImportAccess();
    return { success: true as const, data: await listImportBatches() };
  } catch (error) {
    return actionError(error);
  }
}

export async function getDataImportBatchAction(batchId: string) {
  try {
    await requireImportAccess();
    return { success: true as const, data: await getImportBatch(batchId) };
  } catch (error) {
    return actionError(error);
  }
}

export async function rollbackDataImportAction(
  formData: FormData
): Promise<ActionResult<{ rolledBack: number }>> {
  try {
    await requireImportAccess();
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
    await requireExportAccess();
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
    jobId: string;
  }>
> {
  try {
    await requireExportAccess();
    const exportType = asExportType(String(formData.get('exportType') ?? ''));
    const format = asExportFormat(String(formData.get('format') ?? ''));
    const patientId = String(formData.get('patientId') ?? '').trim() || null;
    const dateFrom = String(formData.get('dateFrom') ?? '').trim() || null;
    const dateTo = String(formData.get('dateTo') ?? '').trim() || null;
    if (!exportType || !format) return { success: false, error: 'Exportación inválida' };

    const job = await createExportJob({
      exportType,
      format,
      patientId,
      dateFrom,
      dateTo,
    });
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
        jobId: result.jobId,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function queueClinicExportAction(formData: FormData): Promise<
  ActionResult<{ jobId: string; status: string }>
> {
  try {
    await requireExportAccess();
    const exportType = asExportType(String(formData.get('exportType') ?? ''));
    const format = asExportFormat(String(formData.get('format') ?? ''));
    const patientId = String(formData.get('patientId') ?? '').trim() || null;
    const dateFrom = String(formData.get('dateFrom') ?? '').trim() || null;
    const dateTo = String(formData.get('dateTo') ?? '').trim() || null;
    if (!exportType || !format) return { success: false, error: 'Exportación inválida' };

    const job = await createExportJob({
      exportType,
      format,
      patientId,
      dateFrom,
      dateTo,
      queueOnly: true,
    });
    revalidatePath('/configuracion');
    return { success: true, data: { jobId: String(job.id), status: 'queued' } };
  } catch (error) {
    return actionError(error);
  }
}

export async function downloadExportArtifactAction(formData: FormData): Promise<
  ActionResult<{ url: string; filename: string }>
> {
  try {
    await requireExportAccess();
    const jobId = String(formData.get('jobId') ?? '');
    if (!jobId) return { success: false, error: 'Job inválido' };
    const data = await getExportDownloadUrl(jobId);
    return { success: true, data };
  } catch (error) {
    return actionError(error);
  }
}

export async function pollImportBatchProgressAction(formData: FormData): Promise<
  ActionResult<{
    id: string;
    status: string;
    progress_processed: number | null;
    progress_total: number | null;
    progress_message: string | null;
    imported_records: number | null;
    failed_records: number | null;
  }>
> {
  try {
    await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const data = await getImportBatchProgress(batchId);
    return {
      success: true,
      data: {
        id: String(data.id),
        status: String(data.status),
        progress_processed: data.progress_processed ?? null,
        progress_total: data.progress_total ?? null,
        progress_message: data.progress_message ?? null,
        imported_records: data.imported_records ?? null,
        failed_records: data.failed_records ?? null,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function downloadValidationReportAction(formData: FormData): Promise<
  ActionResult<{ filename: string; csv: string }>
> {
  try {
    await requireImportAccess();
    const issues = JSON.parse(String(formData.get('validationIssues') ?? '[]')) as ValidationIssue[];
    return {
      success: true,
      data: {
        filename: `SyncVete-validation-report-${Date.now()}.csv`,
        csv: buildValidationReportCsv(issues),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export type SuperadminOrgMigrationStats = {
  organizationId: string;
  imports: Array<Record<string, unknown>>;
  exports: Array<Record<string, unknown>>;
  importTotals: Record<string, unknown>;
  exportTotals: Record<string, unknown>;
};

export async function getSuperadminOrgDataMigrationStats(
  organizationId: string
): Promise<ActionResult<SuperadminOrgMigrationStats>> {
  try {
    await requireSuperadmin();
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_org_data_migration_stats', {
      p_organization_id: organizationId,
    });
    if (error) return { success: false, error: error.message };
    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        organizationId,
        imports: Array.isArray(payload.imports)
          ? (payload.imports as Array<Record<string, unknown>>)
          : [],
        exports: Array.isArray(payload.exports)
          ? (payload.exports as Array<Record<string, unknown>>)
          : [],
        importTotals:
          typeof payload.import_totals === 'object' && payload.import_totals
            ? (payload.import_totals as Record<string, unknown>)
            : {},
        exportTotals:
          typeof payload.export_totals === 'object' && payload.export_totals
            ? (payload.export_totals as Record<string, unknown>)
            : {},
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export type SuperadminMigrationOpsQueue = {
  imports: Array<Record<string, unknown>>;
  exports: Array<Record<string, unknown>>;
  generatedAt: string | null;
};

export async function getSuperadminDataMigrationOpsQueue(
  limit = 40
): Promise<ActionResult<SuperadminMigrationOpsQueue>> {
  try {
    await requireSuperadmin();
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_data_migration_ops_queue', {
      p_limit: limit,
    });
    if (error) return { success: false, error: error.message };
    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        imports: Array.isArray(payload.imports)
          ? (payload.imports as Array<Record<string, unknown>>)
          : [],
        exports: Array.isArray(payload.exports)
          ? (payload.exports as Array<Record<string, unknown>>)
          : [],
        generatedAt: payload.generated_at ? String(payload.generated_at) : null,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelDataImportBatchAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('cancel_own_data_import_batch', {
      p_batch_id: batchId,
    });
    if (error) return { success: false, error: error.message };
    await logDataMigrationAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      action: 'data_import.cancelled',
      entityType: 'data_import_batches',
      entityId: batchId,
    });
    revalidatePath('/configuracion');
    return { success: true, data: { id: String((data as { id?: string } | null)?.id ?? batchId) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function retryDataImportBatchAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('retry_own_data_import_batch', {
      p_batch_id: batchId,
    });
    if (error) return { success: false, error: error.message };
    await logDataMigrationAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      action: 'data_import.retried',
      entityType: 'data_import_batches',
      entityId: batchId,
      newData: data as Record<string, unknown>,
    });
    revalidatePath('/configuracion');
    return { success: true, data: { id: String((data as { id?: string } | null)?.id ?? batchId) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelDataExportJobAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireExportAccess();
    const jobId = String(formData.get('jobId') ?? '');
    if (!jobId) return { success: false, error: 'Job inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('cancel_own_data_export_job', {
      p_job_id: jobId,
    });
    if (error) return { success: false, error: error.message };
    await logDataMigrationAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      action: 'data_export.cancelled',
      entityType: 'data_export_jobs',
      entityId: jobId,
    });
    revalidatePath('/configuracion');
    return { success: true, data: { id: String((data as { id?: string } | null)?.id ?? jobId) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function downloadImportBatchErrorsAction(formData: FormData): Promise<
  ActionResult<{ filename: string; csv: string }>
> {
  try {
    await requireImportAccess();
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('data_import_batch_errors')
      .select(
        'row_number, entity_type, error_code, error_message, field_name, source_reference, severity, recommended_action'
      )
      .eq('batch_id', batchId)
      .order('row_number', { ascending: true })
      .limit(5000);
    if (error) return { success: false, error: error.message };
    const csv = buildBatchErrorsReportCsv(
      (data ?? []).map((row) => ({
        rowNumber: row.row_number,
        entityType: row.entity_type,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        fieldName: row.field_name,
        sourceReference: row.source_reference,
        severity: row.severity,
        recommendedAction: row.recommended_action,
      }))
    );
    return {
      success: true,
      data: {
        filename: `SyncVete-import-errors-${batchId.slice(0, 8)}.csv`,
        csv,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export type DataMigrationIntegrity = {
  organizationId: string;
  generatedAt: string | null;
  imports: Record<string, unknown>;
  exports: Record<string, unknown>;
  createdRowsTracked: number;
  idMapEntries: number;
};

export async function getDataMigrationIntegrityAction(): Promise<ActionResult<DataMigrationIntegrity>> {
  try {
    const canImport = await canPermissionAndFeature('data:import', FEATURES.DATA_IMPORT_EXPORT);
    const canExport = await canPermissionAndFeature('data:export', FEATURES.DATA_IMPORT_EXPORT);
    if (!canImport && !canExport) {
      return { success: false, error: 'No tenés permisos para esta acción' };
    }
    if (canImport) await requireImportAccess();
    else await requireExportAccess();
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('own_data_migration_integrity');
    if (error) return { success: false, error: error.message };
    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        organizationId: String(payload.organization_id ?? ''),
        generatedAt: payload.generated_at ? String(payload.generated_at) : null,
        imports:
          typeof payload.imports === 'object' && payload.imports
            ? (payload.imports as Record<string, unknown>)
            : {},
        exports:
          typeof payload.exports === 'object' && payload.exports
            ? (payload.exports as Record<string, unknown>)
            : {},
        createdRowsTracked: Number(payload.created_rows_tracked ?? 0),
        idMapEntries: Number(payload.id_map_entries ?? 0),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function forceCancelDataImportBatchAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSuperadmin();
    const batchId = String(formData.get('batchId') ?? '');
    if (!batchId) return { success: false, error: 'Lote inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_force_cancel_data_import_batch', {
      p_batch_id: batchId,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/superadmin');
    return {
      success: true,
      data: { id: String((data as { id?: string } | null)?.id ?? batchId) },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function forceCancelDataExportJobAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSuperadmin();
    const jobId = String(formData.get('jobId') ?? '');
    if (!jobId) return { success: false, error: 'Job inválido' };
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('superadmin_force_cancel_data_export_job', {
      p_job_id: jobId,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath('/superadmin');
    return {
      success: true,
      data: { id: String((data as { id?: string } | null)?.id ?? jobId) },
    };
  } catch (error) {
    return actionError(error);
  }
}
