import 'server-only';

import {
  CLINICAL_ENTRY_TYPES,
  CLINICAL_IMPORT_FIELDS,
  DOCUMENT_TYPES,
  OWNER_IMPORT_FIELDS,
  PATIENT_IMPORT_FIELDS,
  PATIENT_SEX,
  PATIENT_SPECIES,
  autoMapColumns,
  mapRow,
  normalizeDocument,
  parseCsv,
  parseImportDate,
  summarizeIssues,
  validateClinicalRows,
  validateOwnerRows,
  validatePatientRows,
  type ClinicalImportRow,
  type ConflictPolicy,
  type DateLocale,
  type ImportType,
  type OwnerImportRow,
  type PatientImportRow,
  type ValidationIssue,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';

/** Temporary until generated Database types include data_migration tables. */
async function migrationDb() {
  return (await createServerClient()) as unknown as {
    from: (table: string) => any;
  };
}

type ExistingOwnerHit = {
  id: string;
  full_name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
};

type ExistingPatientHit = {
  id: string;
  name: string;
  owner_id: string;
  microchip: string | null;
  species: string;
};

function asOwnerRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): OwnerImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    return {
      rowNumber: index + 2,
      externalOwnerId: mapped.external_owner_id ?? '',
      fullName: mapped.full_name ?? '',
      documentType: mapped.document_type || null,
      documentNumber: mapped.document_number || null,
      phone: mapped.phone || null,
      email: mapped.email || null,
      address: mapped.address || null,
      city: mapped.city || null,
      province: mapped.province || null,
      postalCode: mapped.postal_code || null,
      notes: mapped.notes || null,
    };
  });
}

function asPatientRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): PatientImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    const weight = mapped.weight_kg ? Number(String(mapped.weight_kg).replace(',', '.')) : null;
    return {
      rowNumber: index + 2,
      externalPatientId: mapped.external_patient_id ?? '',
      externalOwnerId: mapped.external_owner_id ?? '',
      name: mapped.name ?? '',
      species: mapped.species ?? '',
      breed: mapped.breed || null,
      sex: mapped.sex || 'Desconocido',
      birthDate: mapped.birth_date || null,
      microchip: mapped.microchip || null,
      color: mapped.color || null,
      weightKg: Number.isFinite(weight) ? weight : null,
      status: mapped.status || null,
      notes: mapped.notes || null,
    };
  });
}

function asClinicalRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): ClinicalImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    return {
      rowNumber: index + 2,
      externalClinicalId: mapped.external_clinical_record_id ?? '',
      externalPatientId: mapped.external_patient_id ?? '',
      originalDate: mapped.original_date ?? '',
      originalVeterinarian: mapped.original_veterinarian || null,
      recordType: mapped.record_type || 'consulta',
      reason: mapped.reason || null,
      anamnesis: mapped.anamnesis || null,
      clinicalFindings: mapped.clinical_findings || null,
      diagnosis: mapped.diagnosis || null,
      treatment: mapped.treatment || null,
      observations: mapped.observations || null,
      sourceSystem: mapped.source_system || null,
    };
  });
}

function normalizeSpecies(value: string): (typeof PATIENT_SPECIES)[number] {
  const match = PATIENT_SPECIES.find((s) => s.toLowerCase() === value.trim().toLowerCase());
  return match ?? 'Otro';
}

function normalizeSex(value: string): (typeof PATIENT_SEX)[number] {
  const v = value.trim().toLowerCase();
  if (v.startsWith('m') && !v.includes('hem')) return 'Macho';
  if (v.startsWith('h') || v.includes('f')) return 'Hembra';
  const match = PATIENT_SEX.find((s) => s.toLowerCase() === v);
  return match ?? 'Desconocido';
}

function normalizeDocType(value: string | null): (typeof DOCUMENT_TYPES)[number] {
  if (!value) return 'DNI';
  const match = DOCUMENT_TYPES.find((d) => d.toLowerCase() === value.trim().toLowerCase());
  return match ?? 'Otro';
}

function normalizeEntryType(value: string): (typeof CLINICAL_ENTRY_TYPES)[number] {
  const v = value.trim().toLowerCase();
  const match = CLINICAL_ENTRY_TYPES.find((t) => t === v);
  return match ?? 'otro';
}

export async function createImportBatch(input: {
  importType: ImportType;
  sourceFilename: string;
  sourceFormat: 'csv' | 'json' | 'xlsx' | 'zip';
  sourceSystem?: string | null;
  dateLocale?: DateLocale;
  conflictPolicy?: ConflictPolicy;
}) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data, error } = await supabase
    .from('data_import_batches')
    .insert({
      organization_id: session.organizationId,
      import_type: input.importType,
      status: 'uploaded',
      source_filename: input.sourceFilename,
      source_format: input.sourceFormat,
      source_system: input.sourceSystem ?? null,
      date_locale: input.dateLocale ?? 'es-AR',
      conflict_policy: input.conflictPolicy ?? 'review',
      created_by: session.userId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function analyzeImportFile(input: {
  batchId: string;
  csvText: string;
  entity: 'owners' | 'patients' | 'clinical_entries';
}) {
  await requirePermission('data:import');
  const parsed = parseCsv(input.csvText);
  const fields =
    input.entity === 'owners'
      ? OWNER_IMPORT_FIELDS
      : input.entity === 'patients'
        ? PATIENT_IMPORT_FIELDS
        : CLINICAL_IMPORT_FIELDS;
  const mapping = autoMapColumns(parsed.headers, fields);
  const supabase = await migrationDb();
  const { error } = await supabase
    .from('data_import_batches')
    .update({
      status: 'mapping',
      column_mapping: { [input.entity]: mapping },
      total_records: parsed.rows.length,
      metadata: { headers: parsed.headers, entity: input.entity },
    })
    .eq('id', input.batchId);
  if (error) throw new Error(error.message);
  return { headers: parsed.headers, rows: parsed.rows, mapping, fields };
}

export async function dryRunImport(input: {
  batchId: string;
  csvText: string;
  entity: 'owners' | 'patients' | 'clinical_entries';
  mapping: Record<string, string | null>;
  dateLocale?: DateLocale;
  knownOwnerExternalIds?: string[];
  knownPatientExternalIds?: string[];
}) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data: batch, error: batchError } = await supabase
    .from('data_import_batches')
    .select('*')
    .eq('id', input.batchId)
    .eq('organization_id', session.organizationId)
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? 'Lote no encontrado');

  const parsed = parseCsv(input.csvText);
  const locale = (input.dateLocale ?? batch.date_locale ?? 'es-AR') as DateLocale;
  let issues: ValidationIssue[] = [];
  let readyCount = 0;

  if (input.entity === 'owners') {
    const rows = asOwnerRows(parsed.rows, input.mapping);
    const { data: owners } = await supabase
      .from('owners')
      .select('id, full_name, document_number, email, phone')
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .limit(5000);
    const existingDocuments = new Set(
      ((owners ?? []) as ExistingOwnerHit[])
        .map((o) => (o.document_number ? normalizeDocument(o.document_number) : null))
        .filter(Boolean) as string[]
    );
    const existingEmails = new Set(
      ((owners ?? []) as ExistingOwnerHit[])
        .map((o) => o.email?.toLowerCase() ?? null)
        .filter(Boolean) as string[]
    );
    issues = validateOwnerRows(rows, { existingDocuments, existingEmails });
    const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
    readyCount = rows.filter((r) => !errorRows.has(r.rowNumber)).length;
  } else if (input.entity === 'patients') {
    const rows = asPatientRows(parsed.rows, input.mapping);
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, owner_id, microchip, species')
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .limit(5000);
    const existingMicrochips = new Set(
      ((patients ?? []) as ExistingPatientHit[])
        .map((p) => p.microchip)
        .filter(Boolean) as string[]
    );
    issues = validatePatientRows(rows, {
      knownOwnerExternalIds: new Set(input.knownOwnerExternalIds ?? []),
      existingMicrochips,
      locale,
    });
    const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
    readyCount = rows.filter((r) => !errorRows.has(r.rowNumber)).length;
  } else {
    const rows = asClinicalRows(parsed.rows, input.mapping);
    issues = validateClinicalRows(rows, {
      knownPatientExternalIds: new Set(input.knownPatientExternalIds ?? []),
      locale,
    });
    const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
    readyCount = rows.filter((r) => !errorRows.has(r.rowNumber)).length;
  }

  const summary = summarizeIssues(issues);
  await supabase.from('data_import_batch_errors').delete().eq('batch_id', input.batchId);
  if (issues.length > 0) {
    await supabase.from('data_import_batch_errors').insert(
      issues.slice(0, 500).map((issue) => ({
        batch_id: input.batchId,
        organization_id: session.organizationId,
        row_number: issue.rowNumber,
        entity_type: issue.entityType,
        error_code: issue.code,
        error_message: issue.message,
        field_name: issue.field ?? null,
        source_reference: issue.sourceReference ?? null,
        severity: issue.severity,
        recommended_action: issue.recommendedAction ?? null,
      }))
    );
  }

  await supabase
    .from('data_import_batches')
    .update({
      status: summary.errors > 0 ? 'validating' : 'ready',
      dry_run: true,
      column_mapping: { [input.entity]: input.mapping },
      warning_records: summary.warnings,
      failed_records: summary.errors,
      summary: {
        detected: parsed.rows.length,
        ready: readyCount,
        warnings: summary.warnings,
        errors: summary.errors,
        entity: input.entity,
      },
    })
    .eq('id', input.batchId);

  return {
    detected: parsed.rows.length,
    ready: readyCount,
    warnings: summary.warnings,
    errors: summary.errors,
    issues: issues.slice(0, 200),
  };
}

export async function commitImport(input: {
  batchId: string;
  csvText: string;
  entity: 'owners' | 'patients' | 'clinical_entries';
  mapping: Record<string, string | null>;
  dateLocale?: DateLocale;
  sourceSystem?: string | null;
  ownerIdByExternal?: Record<string, string>;
  patientIdByExternal?: Record<string, string>;
  branchId: string;
}) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data: batch, error: batchError } = await supabase
    .from('data_import_batches')
    .select('*')
    .eq('id', input.batchId)
    .eq('organization_id', session.organizationId)
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? 'Lote no encontrado');

  const parsed = parseCsv(input.csvText);
  const locale = (input.dateLocale ?? batch.date_locale ?? 'es-AR') as DateLocale;
  const nowIso = new Date().toISOString();
  const sourceSystem = input.sourceSystem ?? batch.source_system ?? 'import';

  await supabase
    .from('data_import_batches')
    .update({ status: 'importing', started_at: nowIso, dry_run: false })
    .eq('id', input.batchId);

  let imported = 0;
  let failed = 0;
  let linked = 0;
  const idMap: Record<string, string> = {};

  try {
    if (input.entity === 'owners') {
      const rows = asOwnerRows(parsed.rows, input.mapping);
      const dry = await dryRunImport({
        batchId: input.batchId,
        csvText: input.csvText,
        entity: 'owners',
        mapping: input.mapping,
        dateLocale: locale,
      });
      const blocked = new Set(
        dry.issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber)
      );
      for (const row of rows) {
        if (blocked.has(row.rowNumber)) {
          failed += 1;
          continue;
        }
        const { data, error } = await supabase
          .from('owners')
          .insert({
            organization_id: session.organizationId,
            branch_id: input.branchId,
            full_name: row.fullName,
            document_type: normalizeDocType(row.documentType),
            document_number: row.documentNumber,
            phone: row.phone,
            email: row.email,
            address: row.address,
            city: row.city,
            province: row.province,
            postal_code: row.postalCode,
            notes: row.notes,
            import_batch_id: input.batchId,
            source_system: sourceSystem,
            source_record_id: row.externalOwnerId,
            imported_at: nowIso,
            imported_by: session.userId,
          })
          .select('id')
          .single();
        if (error || !data) {
          failed += 1;
          continue;
        }
        imported += 1;
        idMap[row.externalOwnerId] = data.id;
        await supabase.from('data_import_created_rows').insert({
          batch_id: input.batchId,
          organization_id: session.organizationId,
          entity_type: 'owners',
          entity_id: data.id,
          external_id: row.externalOwnerId,
        });
        await supabase.from('data_import_id_map').insert({
          batch_id: input.batchId,
          organization_id: session.organizationId,
          entity_type: 'owners',
          external_id: row.externalOwnerId,
          internal_id: data.id,
        });
      }
    } else if (input.entity === 'patients') {
      const rows = asPatientRows(parsed.rows, input.mapping);
      const ownerMap = input.ownerIdByExternal ?? {};
      for (const row of rows) {
        const ownerId = ownerMap[row.externalOwnerId];
        if (!ownerId || !row.name) {
          failed += 1;
          continue;
        }
        const birth = row.birthDate ? parseImportDate(row.birthDate, locale) : null;
        if (row.birthDate && (!birth || !birth.ok)) {
          failed += 1;
          continue;
        }
        const { data, error } = await supabase
          .from('patients')
          .insert({
            organization_id: session.organizationId,
            branch_id: input.branchId,
            owner_id: ownerId,
            name: row.name,
            species: normalizeSpecies(row.species),
            breed: row.breed,
            sex: normalizeSex(row.sex),
            birth_date: birth && birth.ok ? birth.isoDate : null,
            microchip: row.microchip,
            color: row.color,
            notes: row.notes,
            is_active: row.status ? row.status.toLowerCase() !== 'inactive' : true,
            import_batch_id: input.batchId,
            source_system: sourceSystem,
            source_record_id: row.externalPatientId,
            imported_at: nowIso,
            imported_by: session.userId,
          })
          .select('id')
          .single();
        if (error || !data) {
          failed += 1;
          continue;
        }
        imported += 1;
        idMap[row.externalPatientId] = data.id;
        await supabase.from('data_import_created_rows').insert({
          batch_id: input.batchId,
          organization_id: session.organizationId,
          entity_type: 'patients',
          entity_id: data.id,
          external_id: row.externalPatientId,
        });
        await supabase.from('data_import_id_map').insert({
          batch_id: input.batchId,
          organization_id: session.organizationId,
          entity_type: 'patients',
          external_id: row.externalPatientId,
          internal_id: data.id,
        });
      }
    } else {
      const rows = asClinicalRows(parsed.rows, input.mapping);
      const patientMap = input.patientIdByExternal ?? {};
      for (const row of rows) {
        const patientId = patientMap[row.externalPatientId];
        const date = parseImportDate(row.originalDate, locale);
        if (!patientId || !date.ok) {
          failed += 1;
          continue;
        }
        const { data: patient } = await supabase
          .from('patients')
          .select('id, owner_id')
          .eq('id', patientId)
          .eq('organization_id', session.organizationId)
          .maybeSingle();
        if (!patient) {
          failed += 1;
          continue;
        }
        const { data, error } = await supabase
          .from('clinical_entries')
          .insert({
            organization_id: session.organizationId,
            branch_id: input.branchId,
            patient_id: patient.id,
            owner_id: patient.owner_id,
            entry_date: `${date.isoDate}T12:00:00.000Z`,
            entry_type: normalizeEntryType(row.recordType),
            title: row.reason,
            anamnesis: row.anamnesis,
            physical_exam: row.clinicalFindings,
            diagnosis: row.diagnosis,
            treatment: row.treatment,
            plan: row.observations,
            recorded_by: session.userId,
            import_batch_id: input.batchId,
            source_system: row.sourceSystem ?? sourceSystem,
            source_record_id: row.externalClinicalId,
            original_created_at: `${date.isoDate}T12:00:00.000Z`,
            original_professional_name: row.originalVeterinarian,
            imported_at: nowIso,
            imported_by: session.userId,
          })
          .select('id')
          .single();
        if (error || !data) {
          failed += 1;
          continue;
        }
        imported += 1;
        await supabase.from('data_import_created_rows').insert({
          batch_id: input.batchId,
          organization_id: session.organizationId,
          entity_type: 'clinical_entries',
          entity_id: data.id,
          external_id: row.externalClinicalId,
        });
      }
    }

    const status =
      failed > 0 && imported > 0
        ? 'completed_with_warnings'
        : failed > 0 && imported === 0
          ? 'failed'
          : 'completed';

    await supabase
      .from('data_import_batches')
      .update({
        status,
        completed_at: new Date().toISOString(),
        imported_records: imported,
        linked_records: linked,
        failed_records: failed,
        summary: {
          imported,
          linked,
          failed,
          entity: input.entity,
          idMap,
        },
      })
      .eq('id', input.batchId);

    return { imported, linked, failed, idMap, status };
  } catch (error) {
    await supabase
      .from('data_import_batches')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Import failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.batchId);
    throw error;
  }
}

export async function listImportBatches(limit = 30) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data, error } = await supabase
    .from('data_import_batches')
    .select('*')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getImportBatch(batchId: string) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data, error } = await supabase
    .from('data_import_batches')
    .select('*')
    .eq('id', batchId)
    .eq('organization_id', session.organizationId)
    .single();
  if (error) throw new Error(error.message);
  const { data: errors } = await supabase
    .from('data_import_batch_errors')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_number', { ascending: true })
    .limit(500);
  return { batch: data, errors: errors ?? [] };
}

export async function rollbackImportBatch(batchId: string) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data: batch } = await supabase
    .from('data_import_batches')
    .select('*')
    .eq('id', batchId)
    .eq('organization_id', session.organizationId)
    .single();
  if (!batch) throw new Error('Lote no encontrado');
  if (batch.status === 'rolled_back') throw new Error('Este lote ya fue revertido');

  const { data: created } = await supabase
    .from('data_import_created_rows')
    .select('*')
    .eq('batch_id', batchId)
    .eq('organization_id', session.organizationId);

  const rows = created ?? [];
  // Soft-delete only untouched imported rows (updated_at ~= imported / created window)
  for (const row of rows) {
    if (row.entity_type === 'clinical_entries') {
      const { data: entry } = await supabase
        .from('clinical_entries')
        .select('id, updated_at, imported_at')
        .eq('id', row.entity_id)
        .eq('import_batch_id', batchId)
        .maybeSingle();
      if (!entry) continue;
      if (entry.imported_at && entry.updated_at && entry.updated_at > entry.imported_at) {
        throw new Error(
          'Rollback bloqueado: hay registros clínicos modificados después del import'
        );
      }
      await supabase
        .from('clinical_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', row.entity_id)
        .eq('organization_id', session.organizationId);
    } else if (row.entity_type === 'patients') {
      const { count } = await supabase
        .from('clinical_entries')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', row.entity_id)
        .is('deleted_at', null)
        .neq('import_batch_id', batchId);
      if ((count ?? 0) > 0) {
        throw new Error(
          'Rollback bloqueado: hay pacientes del lote con historia clínica posterior'
        );
      }
      await supabase
        .from('patients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', row.entity_id)
        .eq('organization_id', session.organizationId)
        .eq('import_batch_id', batchId);
    } else if (row.entity_type === 'owners') {
      const { count } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', row.entity_id)
        .is('deleted_at', null)
        .neq('import_batch_id', batchId);
      if ((count ?? 0) > 0) {
        throw new Error('Rollback bloqueado: hay propietarios con pacientes posteriores');
      }
      await supabase
        .from('owners')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', row.entity_id)
        .eq('organization_id', session.organizationId)
        .eq('import_batch_id', batchId);
    }
  }

  await supabase
    .from('data_import_batches')
    .update({
      status: 'rolled_back',
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: session.userId,
    })
    .eq('id', batchId);

  return { rolledBack: rows.length };
}
