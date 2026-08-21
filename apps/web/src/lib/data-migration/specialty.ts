import 'server-only';

import {
  LAB_ORDER_IMPORT_FIELDS,
  PRESCRIPTION_IMPORT_FIELDS,
  SURGERY_IMPORT_FIELDS,
  mapRow,
  parseImportDate,
  validateLabOrderRows,
  validatePrescriptionRows,
  validateSurgeryRows,
  type DateLocale,
  type LabOrderImportRow,
  type PrescriptionImportRow,
  type SurgeryImportRow,
  type ValidationIssue,
} from '@sincvete/shared';

export type SpecialtyEntity = 'lab_orders' | 'surgeries' | 'prescriptions';

export function fieldsForSpecialty(entity: SpecialtyEntity) {
  if (entity === 'lab_orders') return LAB_ORDER_IMPORT_FIELDS;
  if (entity === 'surgeries') return SURGERY_IMPORT_FIELDS;
  return PRESCRIPTION_IMPORT_FIELDS;
}

export function asLabOrderRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): LabOrderImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    return {
      rowNumber: index + 2,
      externalLabOrderId: mapped.external_lab_order_id ?? '',
      externalPatientId: mapped.external_patient_id ?? '',
      orderedAt: mapped.ordered_at ?? '',
      title: mapped.title ?? '',
      tests: mapped.tests || null,
      priority: mapped.priority || null,
      sampleType: mapped.sample_type || null,
      interpretation: mapped.interpretation || null,
      originalVeterinarian: mapped.original_veterinarian || null,
      notes: mapped.notes || null,
      sourceSystem: mapped.source_system || null,
    };
  });
}

export function asSurgeryRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): SurgeryImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    return {
      rowNumber: index + 2,
      externalSurgeryId: mapped.external_surgery_id ?? '',
      externalPatientId: mapped.external_patient_id ?? '',
      scheduledAt: mapped.scheduled_at ?? '',
      procedureName: mapped.procedure_name ?? '',
      diagnosis: mapped.diagnosis || null,
      anesthesia: mapped.anesthesia || null,
      asa: mapped.asa || null,
      originalVeterinarian: mapped.original_veterinarian || null,
      notes: mapped.notes || null,
      sourceSystem: mapped.source_system || null,
    };
  });
}

export function asPrescriptionRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>
): PrescriptionImportRow[] {
  return rawRows.map((raw, index) => {
    const mapped = mapRow(raw, mapping);
    return {
      rowNumber: index + 2,
      externalPrescriptionId: mapped.external_prescription_id ?? '',
      externalPatientId: mapped.external_patient_id ?? '',
      prescribedAt: mapped.prescribed_at ?? '',
      medicationName: mapped.medication_name ?? '',
      dose: mapped.dose ?? '',
      frequency: mapped.frequency ?? '',
      duration: mapped.duration || null,
      route: mapped.route || null,
      quantity: mapped.quantity || null,
      instructions: mapped.instructions || null,
      originalVeterinarian: mapped.original_veterinarian || null,
      notes: mapped.notes || null,
      sourceSystem: mapped.source_system || null,
    };
  });
}

export function validateSpecialtyRows(
  entity: SpecialtyEntity,
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>,
  options: { knownPatientExternalIds?: string[]; locale?: DateLocale }
): { issues: ValidationIssue[]; readyCount: number; rows: unknown[] } {
  const known = new Set(options.knownPatientExternalIds ?? []);
  const locale = options.locale ?? 'es-AR';
  if (entity === 'lab_orders') {
    const rows = asLabOrderRows(rawRows, mapping);
    const issues = validateLabOrderRows(rows, { knownPatientExternalIds: known, locale });
    const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
    return {
      issues,
      readyCount: rows.filter((r) => !errorRows.has(r.rowNumber)).length,
      rows,
    };
  }
  if (entity === 'surgeries') {
    const rows = asSurgeryRows(rawRows, mapping);
    const issues = validateSurgeryRows(rows, { knownPatientExternalIds: known, locale });
    const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
    return {
      issues,
      readyCount: rows.filter((r) => !errorRows.has(r.rowNumber)).length,
      rows,
    };
  }
  const rows = asPrescriptionRows(rawRows, mapping);
  const issues = validatePrescriptionRows(rows, { knownPatientExternalIds: known, locale });
  const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.rowNumber));
  return {
    issues,
    readyCount: rows.filter((r) => !errorRows.has(r.rowNumber)).length,
    rows,
  };
}

function normalizeLabPriority(value: string | null): 'rutina' | 'urgente' {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'urgente' || v === 'urgent' ? 'urgente' : 'rutina';
}

function normalizeSampleType(
  value: string | null
): 'sangre' | 'orina' | 'materia_fecal' | 'hisopado' | 'otro' | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes('sangre') || v === 'blood') return 'sangre';
  if (v.includes('orina') || v === 'urine') return 'orina';
  if (v.includes('fecal') || v.includes('heces')) return 'materia_fecal';
  if (v.includes('hisop')) return 'hisopado';
  return 'otro';
}

function normalizeAnesthesia(
  value: string | null
): 'general' | 'sedacion' | 'local' | 'epidural' | 'otro' | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith('gen')) return 'general';
  if (v.startsWith('sed')) return 'sedacion';
  if (v.startsWith('loc')) return 'local';
  if (v.startsWith('epi')) return 'epidural';
  return 'otro';
}

function normalizeAsa(value: string | null): 'I' | 'II' | 'III' | 'IV' | 'V' | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (v === 'I' || v === 'II' || v === 'III' || v === 'IV' || v === 'V') return v;
  return null;
}

function normalizeRxRoute(
  value: string | null
): 'oral' | 'sc' | 'im' | 'topico' | 'oftalmico' | 'otico' | 'otro' {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'oral' || v === 'po') return 'oral';
  if (v === 'sc' || v === 'subcutanea' || v === 'subcutánea') return 'sc';
  if (v === 'im' || v === 'intramuscular') return 'im';
  if (v.includes('top')) return 'topico';
  if (v.includes('oftalm')) return 'oftalmico';
  if (v.includes('ot')) return 'otico';
  return 'otro';
}

export async function commitSpecialtySlice(input: {
  supabase: { from: (table: string) => any };
  entity: SpecialtyEntity;
  rows: Record<string, string>[];
  mapping: Record<string, string | null>;
  locale: DateLocale;
  patientIdByExternal: Record<string, string>;
  organizationId: string;
  branchId: string;
  batchId: string;
  userId: string;
  sourceSystem?: string | null;
  offset: number;
  limit: number;
}): Promise<{ imported: number; failed: number; idMap: Record<string, string> }> {
  const slice = input.rows.slice(input.offset, input.offset + input.limit);
  const nowIso = new Date().toISOString();
  let imported = 0;
  let failed = 0;
  const idMap: Record<string, string> = {};

  if (input.entity === 'lab_orders') {
    const rows = asLabOrderRows(slice, input.mapping).map((row, idx) => ({
      ...row,
      rowNumber: input.offset + idx + 2,
    }));
    for (const row of rows) {
      const patientId = input.patientIdByExternal[row.externalPatientId];
      const date = parseImportDate(row.orderedAt, input.locale);
      if (!patientId || !date.ok || !row.title.trim()) {
        failed += 1;
        continue;
      }
      const { data: patient } = await input.supabase
        .from('patients')
        .select('id, owner_id')
        .eq('id', patientId)
        .eq('organization_id', input.organizationId)
        .maybeSingle();
      if (!patient) {
        failed += 1;
        continue;
      }
      const hasResult = Boolean(row.interpretation?.trim());
      const { data, error } = await input.supabase
        .from('lab_orders')
        .insert({
          organization_id: input.organizationId,
          branch_id: input.branchId,
          patient_id: patient.id,
          owner_id: patient.owner_id,
          ordered_by: input.userId,
          status: hasResult ? 'completada' : 'solicitada',
          priority: normalizeLabPriority(row.priority),
          sample_type: normalizeSampleType(row.sampleType),
          title: row.title.trim(),
          ordered_at: `${date.isoDate}T12:00:00.000Z`,
          completed_at: hasResult ? `${date.isoDate}T12:00:00.000Z` : null,
          interpretation: row.interpretation,
          notes: [row.notes, row.originalVeterinarian ? `Profesional original: ${row.originalVeterinarian}` : null]
            .filter(Boolean)
            .join('\n') || null,
          import_batch_id: input.batchId,
          source_system: row.sourceSystem ?? input.sourceSystem,
          source_record_id: row.externalLabOrderId,
          original_created_at: `${date.isoDate}T12:00:00.000Z`,
          original_professional_name: row.originalVeterinarian,
          imported_at: nowIso,
          imported_by: input.userId,
        })
        .select('id')
        .single();
      if (error || !data) {
        failed += 1;
        continue;
      }
      const tests = (row.tests ?? '')
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tests.length > 0) {
        await input.supabase.from('lab_order_items').insert(
          tests.map((testName, index) => ({
            organization_id: input.organizationId,
            lab_order_id: data.id,
            test_name: testName.slice(0, 120),
            sort_order: index,
            flag: hasResult ? 'normal' : 'pendiente',
          }))
        );
      }
      imported += 1;
      idMap[row.externalLabOrderId] = data.id;
      await input.supabase.from('data_import_created_rows').insert({
        batch_id: input.batchId,
        organization_id: input.organizationId,
        entity_type: 'lab_orders',
        entity_id: data.id,
        external_id: row.externalLabOrderId,
      });
    }
    return { imported, failed, idMap };
  }

  if (input.entity === 'surgeries') {
    const rows = asSurgeryRows(slice, input.mapping).map((row, idx) => ({
      ...row,
      rowNumber: input.offset + idx + 2,
    }));
    for (const row of rows) {
      const patientId = input.patientIdByExternal[row.externalPatientId];
      const date = parseImportDate(row.scheduledAt, input.locale);
      if (!patientId || !date.ok || !row.procedureName.trim()) {
        failed += 1;
        continue;
      }
      const { data: patient } = await input.supabase
        .from('patients')
        .select('id, owner_id')
        .eq('id', patientId)
        .eq('organization_id', input.organizationId)
        .maybeSingle();
      if (!patient) {
        failed += 1;
        continue;
      }
      const { data, error } = await input.supabase
        .from('surgeries')
        .insert({
          organization_id: input.organizationId,
          branch_id: input.branchId,
          patient_id: patient.id,
          owner_id: patient.owner_id,
          surgeon_id: input.userId,
          status: 'completada',
          scheduled_at: `${date.isoDate}T12:00:00.000Z`,
          completed_at: `${date.isoDate}T12:00:00.000Z`,
          procedure_name: row.procedureName.trim(),
          diagnosis: row.diagnosis,
          anesthesia: normalizeAnesthesia(row.anesthesia),
          asa: normalizeAsa(row.asa),
          notes: [row.notes, row.originalVeterinarian ? `Cirujano original: ${row.originalVeterinarian}` : null]
            .filter(Boolean)
            .join('\n') || null,
          import_batch_id: input.batchId,
          source_system: row.sourceSystem ?? input.sourceSystem,
          source_record_id: row.externalSurgeryId,
          original_created_at: `${date.isoDate}T12:00:00.000Z`,
          original_professional_name: row.originalVeterinarian,
          imported_at: nowIso,
          imported_by: input.userId,
        })
        .select('id')
        .single();
      if (error || !data) {
        failed += 1;
        continue;
      }
      imported += 1;
      idMap[row.externalSurgeryId] = data.id;
      await input.supabase.from('data_import_created_rows').insert({
        batch_id: input.batchId,
        organization_id: input.organizationId,
        entity_type: 'surgeries',
        entity_id: data.id,
        external_id: row.externalSurgeryId,
      });
    }
    return { imported, failed, idMap };
  }

  const rows = asPrescriptionRows(slice, input.mapping).map((row, idx) => ({
    ...row,
    rowNumber: input.offset + idx + 2,
  }));
  for (const row of rows) {
    const patientId = input.patientIdByExternal[row.externalPatientId];
    const date = parseImportDate(row.prescribedAt, input.locale);
    if (!patientId || !date.ok || !row.medicationName || !row.dose || !row.frequency) {
      failed += 1;
      continue;
    }
    const { data: patient } = await input.supabase
      .from('patients')
      .select('id, owner_id')
      .eq('id', patientId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();
    if (!patient) {
      failed += 1;
      continue;
    }
    const { data, error } = await input.supabase
      .from('prescriptions')
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        patient_id: patient.id,
        owner_id: patient.owner_id,
        prescribed_by: input.userId,
        status: 'activa',
        notes: [row.notes, row.originalVeterinarian ? `Profesional original: ${row.originalVeterinarian}` : null]
          .filter(Boolean)
          .join('\n') || null,
        prescribed_at: `${date.isoDate}T12:00:00.000Z`,
        import_batch_id: input.batchId,
        source_system: row.sourceSystem ?? input.sourceSystem,
        source_record_id: row.externalPrescriptionId,
        original_created_at: `${date.isoDate}T12:00:00.000Z`,
        original_professional_name: row.originalVeterinarian,
        imported_at: nowIso,
        imported_by: input.userId,
      })
      .select('id')
      .single();
    if (error || !data) {
      failed += 1;
      continue;
    }
    const qty = row.quantity ? Number(row.quantity.replace(',', '.')) : 0;
    await input.supabase.from('prescription_items').insert({
      organization_id: input.organizationId,
      prescription_id: data.id,
      medication_name: row.medicationName.slice(0, 160),
      dose: row.dose.slice(0, 80),
      frequency: row.frequency.slice(0, 80),
      duration: row.duration?.slice(0, 80) ?? null,
      route: normalizeRxRoute(row.route),
      quantity: Number.isFinite(qty) ? qty : 0,
      instructions: row.instructions?.slice(0, 1000) ?? null,
      sort_order: 0,
    });
    imported += 1;
    idMap[row.externalPrescriptionId] = data.id;
    await input.supabase.from('data_import_created_rows').insert({
      batch_id: input.batchId,
      organization_id: input.organizationId,
      entity_type: 'prescriptions',
      entity_id: data.id,
      external_id: row.externalPrescriptionId,
    });
  }
  return { imported, failed, idMap };
}
