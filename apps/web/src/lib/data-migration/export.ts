import 'server-only';

import {
  DATA_MIGRATION_FORMAT,
  DATA_MIGRATION_FORMAT_VERSION,
  isSpecialtyExportType,
  normalizeExportDateRange,
  toCsv,
  type ExportFormat,
  type ExportType,
} from '@sincvete/shared';
import JSZip from 'jszip';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { migrationDb } from '@/lib/data-migration/db';

const EXPORT_RETENTION_DAYS = 7;

type DateBounds = { dateFrom: string | null; dateTo: string | null };

function applyDateFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MigrationDb chain
  query: any,
  column: string,
  bounds: DateBounds
) {
  let next = query;
  if (bounds.dateFrom) next = next.gte(column, `${bounds.dateFrom}T00:00:00.000Z`);
  if (bounds.dateTo) next = next.lte(column, `${bounds.dateTo}T23:59:59.999Z`);
  return next;
}

export async function createExportJob(input: {
  exportType: ExportType;
  format: ExportFormat;
  patientId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  queueOnly?: boolean;
}) {
  const session = await requirePermission('data:export');
  const supabase = await migrationDb();

  if (input.queueOnly) {
    const { count: activeCount } = await supabase
      .from('data_export_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', session.organizationId)
      .in('status', ['queued', 'running']);
    if ((activeCount ?? 0) > 0) {
      throw new Error('Ya hay una exportación en cola o en curso para esta clínica');
    }
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + EXPORT_RETENTION_DAYS);
  const bounds = normalizeExportDateRange({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const { data, error } = await supabase
    .from('data_export_jobs')
    .insert({
      organization_id: session.organizationId,
      export_type: input.exportType,
      format: input.format,
      status: 'queued',
      created_by: session.userId,
      patient_id: input.patientId ?? null,
      date_from: bounds.dateFrom,
      date_to: bounds.dateTo,
      queued_at: input.queueOnly ? new Date().toISOString() : null,
      expires_at: expires.toISOString(),
      progress_message: input.queueOnly ? 'En cola para exportación' : null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error.message);
  if (input.queueOnly) {
    const { logDataMigrationAudit } = await import('@/lib/data-migration/audit');
    await logDataMigrationAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      action: 'data_export.queued',
      entityType: 'data_export_jobs',
      entityId: String(data.id),
      newData: { exportType: input.exportType, format: input.format },
    });
  }
  return data;
}

export async function listExportJobs(limit = 30) {
  const session = await requirePermission('data:export');
  const supabase = await migrationDb();
  const { data, error } = await supabase
    .from('data_export_jobs')
    .select('*')
    .eq('organization_id', session.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchOwners(organizationId: string, db?: Awaited<ReturnType<typeof migrationDb>>) {
  const supabase = db ?? (await migrationDb());
  const { data, error } = await supabase
    .from('owners')
    .select(
      'id, full_name, email, phone, document_type, document_number, address, city, province, postal_code, notes, is_active, source_system, source_record_id, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(10000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPatients(organizationId: string, db?: Awaited<ReturnType<typeof migrationDb>>) {
  const supabase = db ?? (await migrationDb());
  const { data, error } = await supabase
    .from('patients')
    .select(
      'id, owner_id, name, species, breed, sex, birth_date, microchip, color, notes, is_active, is_deceased, source_system, source_record_id, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(10000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchClinicalEntries(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('clinical_entries')
    .select(
      'id, patient_id, owner_id, entry_date, entry_type, title, anamnesis, physical_exam, diagnosis, treatment, plan, weight_kg, temperature_c, notes, source_system, source_record_id, original_created_at, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: true })
    .limit(20000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'entry_date', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchVaccinations(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('vaccinations')
    .select(
      'id, patient_id, owner_id, vaccine_name, manufacturer, lot_number, administered_at, next_due_at, notes, source_system, source_record_id, original_created_at, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('administered_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'administered_at', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLabOrders(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('lab_orders')
    .select(
      'id, patient_id, owner_id, title, status, priority, sample_type, ordered_at, completed_at, interpretation, notes, source_system, source_record_id, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('ordered_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'ordered_at', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLabOrderItems(
  organizationId: string,
  labOrderIds: string[],
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  if (labOrderIds.length === 0) return [];
  const supabase = db ?? (await migrationDb());
  const { data, error } = await supabase
    .from('lab_order_items')
    .select(
      'id, lab_order_id, test_name, result_value, unit, reference_range, flag, sort_order, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('lab_order_id', labOrderIds.slice(0, 2000))
    .order('sort_order', { ascending: true })
    .limit(20000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchSurgeries(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('surgeries')
    .select(
      'id, patient_id, owner_id, procedure_name, status, scheduled_at, started_at, completed_at, notes, source_system, source_record_id, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'scheduled_at', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPrescriptions(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('prescriptions')
    .select(
      'id, patient_id, owner_id, status, notes, prescribed_at, source_system, source_record_id, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('prescribed_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'prescribed_at', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPrescriptionItems(
  organizationId: string,
  prescriptionIds: string[],
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  if (prescriptionIds.length === 0) return [];
  const supabase = db ?? (await migrationDb());
  const { data, error } = await supabase
    .from('prescription_items')
    .select(
      'id, prescription_id, medication_name, dose, frequency, duration, route, quantity, instructions, sort_order, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('prescription_id', prescriptionIds.slice(0, 2000))
    .order('sort_order', { ascending: true })
    .limit(20000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchHospitalizations(
  organizationId: string,
  patientId?: string | null,
  bounds?: DateBounds,
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  const supabase = db ?? (await migrationDb());
  let query = supabase
    .from('hospitalizations')
    .select(
      'id, patient_id, owner_id, status, admitted_at, discharged_at, cage, reason, diagnosis, treatment_plan, notes, source_system, source_record_id, original_professional_name, imported_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('admitted_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  if (bounds) query = applyDateFilter(query, 'admitted_at', bounds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchClinicalImages(
  organizationId: string,
  patientIds: string[],
  db?: Awaited<ReturnType<typeof migrationDb>>
) {
  if (patientIds.length === 0) return [];
  const supabase = db ?? (await migrationDb());
  const { data, error } = await supabase
    .from('clinical_images')
    .select(
      'id, patient_id, kind, title, notes, storage_path, mime_type, file_size, original_name, taken_at, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('patient_id', patientIds.slice(0, 200))
    .order('taken_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function buildClinicalPdfHtml(input: {
  clinicName: string;
  patient: Record<string, unknown>;
  owner: Record<string, unknown> | null;
  entries: Array<Record<string, unknown>>;
  vaccinations: Array<Record<string, unknown>>;
  labOrders?: Array<Record<string, unknown>>;
  surgeries?: Array<Record<string, unknown>>;
  prescriptions?: Array<Record<string, unknown>>;
  prescriptionItems?: Array<Record<string, unknown>>;
  hospitalizations?: Array<Record<string, unknown>>;
  exportedAt: string;
}) {
  const entriesHtml = input.entries
    .map((entry) => {
      const provenance =
        entry.source_system || entry.original_professional_name
          ? `<p><em>Registro importado${
              entry.source_system ? ` · Origen: ${String(entry.source_system)}` : ''
            }${
              entry.original_professional_name
                ? ` · Profesional original: ${String(entry.original_professional_name)}`
                : ''
            }${
              entry.original_created_at
                ? ` · Fecha original: ${String(entry.original_created_at)}`
                : ''
            }</em></p>`
          : '';
      return `<section style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #ddd">
        <h3>${String(entry.entry_date ?? '')} · ${String(entry.entry_type ?? '')}</h3>
        <p><strong>${String(entry.title ?? 'Evolución')}</strong></p>
        ${entry.anamnesis ? `<p><strong>Anamnesis:</strong> ${String(entry.anamnesis)}</p>` : ''}
        ${entry.physical_exam ? `<p><strong>Examen:</strong> ${String(entry.physical_exam)}</p>` : ''}
        ${entry.diagnosis ? `<p><strong>Diagnóstico:</strong> ${String(entry.diagnosis)}</p>` : ''}
        ${entry.treatment ? `<p><strong>Tratamiento:</strong> ${String(entry.treatment)}</p>` : ''}
        ${entry.plan ? `<p><strong>Plan:</strong> ${String(entry.plan)}</p>` : ''}
        ${provenance}
      </section>`;
    })
    .join('\n');

  const itemsByRx = new Map<string, Array<Record<string, unknown>>>();
  for (const item of input.prescriptionItems ?? []) {
    const key = String(item.prescription_id ?? '');
    if (!key) continue;
    const list = itemsByRx.get(key) ?? [];
    list.push(item);
    itemsByRx.set(key, list);
  }

  const labHtml = (input.labOrders ?? [])
    .map(
      (row) =>
        `<li>${String(row.ordered_at ?? '')} — ${String(row.title ?? '')} (${String(row.status ?? '')})${
          row.interpretation ? `: ${String(row.interpretation)}` : ''
        }</li>`
    )
    .join('');
  const surgeryHtml = (input.surgeries ?? [])
    .map(
      (row) =>
        `<li>${String(row.scheduled_at ?? '')} — ${String(row.procedure_name ?? '')} (${String(row.status ?? '')})</li>`
    )
    .join('');
  const rxHtml = (input.prescriptions ?? [])
    .map((row) => {
      const items = itemsByRx.get(String(row.id ?? '')) ?? [];
      const itemsHtml = items
        .map(
          (item) =>
            `<li>${String(item.medication_name ?? '')} · ${String(item.dose ?? '')} · ${String(item.frequency ?? '')}${
              item.duration ? ` · ${String(item.duration)}` : ''
            }</li>`
        )
        .join('');
      return `<section style="margin-bottom:12px">
        <p><strong>${String(row.prescribed_at ?? '')}</strong> · ${String(row.status ?? '')}</p>
        ${itemsHtml ? `<ul>${itemsHtml}</ul>` : '<p class="meta">Sin ítems</p>'}
        ${row.notes ? `<p>${String(row.notes)}</p>` : ''}
      </section>`;
    })
    .join('');
  const hospHtml = (input.hospitalizations ?? [])
    .map(
      (row) =>
        `<li>${String(row.admitted_at ?? '')} → ${String(row.discharged_at ?? '—')} · ${String(row.reason ?? '')}${
          row.diagnosis ? ` · ${String(row.diagnosis)}` : ''
        }</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Historia clínica — ${String(input.patient.name ?? '')}</title>
  <style>
    body { font-family: Georgia, serif; color: #111; margin: 32px; }
    h1,h2,h3 { font-family: Arial, sans-serif; }
    .meta { color: #444; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${input.clinicName}</h1>
  <p class="meta">Exportado: ${input.exportedAt}</p>
  <h2>Paciente: ${String(input.patient.name ?? '')}</h2>
  <p class="meta">
    Especie: ${String(input.patient.species ?? '')}
    · Sexo: ${String(input.patient.sex ?? '')}
    · Nacimiento: ${String(input.patient.birth_date ?? '—')}
    · Microchip: ${String(input.patient.microchip ?? '—')}
  </p>
  <h2>Propietario</h2>
  <p class="meta">${String(input.owner?.full_name ?? '—')} · ${String(input.owner?.phone ?? '')} · ${String(input.owner?.email ?? '')}</p>
  <h2>Historia clínica</h2>
  ${entriesHtml || '<p>Sin evoluciones.</p>'}
  <h2>Vacunaciones</h2>
  <ul>
    ${input.vaccinations
      .map(
        (v) =>
          `<li>${String(v.administered_at ?? '')} — ${String(v.vaccine_name ?? '')}${
            v.next_due_at ? ` (próxima: ${String(v.next_due_at)})` : ''
          }</li>`
      )
      .join('')}
  </ul>
  <h2>Laboratorio</h2>
  <ul>${labHtml || '<li>Sin órdenes.</li>'}</ul>
  <h2>Cirugías</h2>
  <ul>${surgeryHtml || '<li>Sin cirugías.</li>'}</ul>
  <h2>Recetas</h2>
  ${rxHtml || '<p>Sin recetas.</p>'}
  <h2>Internaciones</h2>
  <ul>${hospHtml || '<li>Sin internaciones.</li>'}</ul>
</body>
</html>`;
}

export async function runExportJob(
  jobId: string,
  options?: { asService?: boolean }
): Promise<{
  jobId: string;
  filename: string;
  contentType: string;
  body: string | Uint8Array;
  recordCounts: Record<string, number>;
  storagePath?: string | null;
}> {
  let organizationId: string;
  let userId: string | null;
  let supabase: Awaited<ReturnType<typeof migrationDb>>;

  if (options?.asService) {
    const { createServiceClient } = await import('@/lib/supabase/server');
    supabase = (await createServiceClient()) as unknown as Awaited<ReturnType<typeof migrationDb>>;
    const { data: jobRow, error: jobErr } = await supabase
      .from('data_export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobErr || !jobRow) throw new Error(jobErr?.message ?? 'Export no encontrado');
    organizationId = String(jobRow.organization_id);
    userId = (jobRow.created_by as string | null) ?? null;
  } else {
    const session = await requirePermission('data:export');
    organizationId = session.organizationId;
    userId = session.userId;
    supabase = await migrationDb();
  }

  const { data: job, error } = await supabase
    .from('data_export_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !job) throw new Error(error?.message ?? 'Export no encontrado');

  await supabase
    .from('data_export_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const bounds = normalizeExportDateRange({
      dateFrom: job.date_from,
      dateTo: job.date_to,
    });
    const exportType = String(job.export_type) as ExportType;
    const specialtyOnly = isSpecialtyExportType(exportType);

    await supabase
      .from('data_export_jobs')
      .update({ progress_message: 'Leyendo registros del tenant…' })
      .eq('id', jobId);

    const needOwners =
      exportType === 'owners' ||
      exportType === 'full_clinic' ||
      exportType === 'patient_clinical' ||
      exportType === 'patients';
    const needPatients =
      exportType !== 'owners' &&
      (exportType === 'patients' ||
        exportType === 'full_clinic' ||
        exportType === 'patient_clinical' ||
        exportType === 'clinical_entries' ||
        exportType === 'vaccinations' ||
        specialtyOnly);
    const needClinical =
      exportType === 'clinical_entries' ||
      exportType === 'patient_clinical' ||
      exportType === 'full_clinic';
    const needVaccinations =
      exportType === 'vaccinations' ||
      exportType === 'patient_clinical' ||
      exportType === 'full_clinic';
    const needLab =
      exportType === 'lab_orders' || exportType === 'full_clinic' || exportType === 'patient_clinical';
    const needSurgeries =
      exportType === 'surgeries' || exportType === 'full_clinic' || exportType === 'patient_clinical';
    const needRx =
      exportType === 'prescriptions' ||
      exportType === 'full_clinic' ||
      exportType === 'patient_clinical';
    const needHosp =
      exportType === 'hospitalizations' ||
      exportType === 'full_clinic' ||
      exportType === 'patient_clinical';

    const owners = needOwners ? await fetchOwners(organizationId, supabase) : [];
    const patients = needPatients ? await fetchPatients(organizationId, supabase) : [];
    const clinical = needClinical
      ? await fetchClinicalEntries(organizationId, job.patient_id, bounds, supabase)
      : [];
    const vaccinations = needVaccinations
      ? await fetchVaccinations(organizationId, job.patient_id, bounds, supabase)
      : [];
    const labOrders = needLab
      ? await fetchLabOrders(organizationId, job.patient_id, bounds, supabase)
      : [];
    const labOrderItems = needLab
      ? await fetchLabOrderItems(
          organizationId,
          labOrders.map((row: { id: string }) => row.id),
          supabase
        )
      : [];
    const surgeries = needSurgeries
      ? await fetchSurgeries(organizationId, job.patient_id, bounds, supabase)
      : [];
    const prescriptions = needRx
      ? await fetchPrescriptions(organizationId, job.patient_id, bounds, supabase)
      : [];
    const prescriptionItems = needRx
      ? await fetchPrescriptionItems(
          organizationId,
          prescriptions.map((row: { id: string }) => row.id),
          supabase
        )
      : [];
    const hospitalizations = needHosp
      ? await fetchHospitalizations(organizationId, job.patient_id, bounds, supabase)
      : [];

    const filteredPatients = job.patient_id
      ? patients.filter((p: { id: string }) => p.id === job.patient_id)
      : patients;
    const filteredOwners =
      job.patient_id && filteredPatients[0]
        ? owners.filter((o: { id: string }) => o.id === filteredPatients[0]!.owner_id)
        : owners;

    const recordCounts: Record<string, number> = {
      owners: filteredOwners.length,
      patients: filteredPatients.length,
      clinicalEntries: clinical.length,
      vaccinations: vaccinations.length,
      labOrders: labOrders.length,
      labOrderItems: labOrderItems.length,
      surgeries: surgeries.length,
      prescriptions: prescriptions.length,
      prescriptionItems: prescriptionItems.length,
      hospitalizations: hospitalizations.length,
    };

    const manifest = {
      format: DATA_MIGRATION_FORMAT,
      version: DATA_MIGRATION_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      organizationId: organizationId,
      organizationName: org?.name ?? null,
      exportType: job.export_type,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
      generatedBy: userId,
      entities: recordCounts,
    };

    let body: string | Uint8Array;
    let filename: string;
    let contentType: string;

    const specialtyRows =
      exportType === 'lab_orders'
        ? labOrders
        : exportType === 'surgeries'
          ? surgeries
          : exportType === 'prescriptions'
            ? prescriptions
            : exportType === 'hospitalizations'
              ? hospitalizations
              : exportType === 'vaccinations'
                ? vaccinations
                : null;

    if (job.format === 'json') {
      body = JSON.stringify(
        {
          manifest,
          owners: filteredOwners,
          patients: filteredPatients,
          clinicalEntries: clinical,
          vaccinations,
          labOrders,
          surgeries,
          prescriptions,
          hospitalizations,
        },
        null,
        2
      );
      filename = `syncvete-export-${job.export_type}-${Date.now()}.json`;
      contentType = 'application/json;charset=utf-8';
    } else if (job.format === 'csv' || job.format === 'xlsx') {
      let csv: string;
      if (exportType === 'owners') {
        csv = toCsv(
          [
            'id',
            'full_name',
            'document_type',
            'document_number',
            'phone',
            'email',
            'city',
            'source_record_id',
          ],
          filteredOwners
        );
      } else if (exportType === 'patients') {
        csv = toCsv(
          [
            'id',
            'owner_id',
            'name',
            'species',
            'breed',
            'sex',
            'birth_date',
            'microchip',
            'source_record_id',
          ],
          filteredPatients
        );
      } else if (exportType === 'vaccinations') {
        csv = toCsv(
          [
            'id',
            'patient_id',
            'vaccine_name',
            'administered_at',
            'next_due_at',
            'manufacturer',
            'lot_number',
            'source_record_id',
          ],
          vaccinations
        );
      } else if (exportType === 'lab_orders') {
        const labById = new Map(
          labOrders.map((row: { id: string }) => [row.id, row] as const)
        );
        csv = toCsv(
          [
            'lab_order_id',
            'patient_id',
            'ordered_at',
            'title',
            'status',
            'test_name',
            'result_value',
            'result_unit',
            'reference_range',
            'flag',
            'source_record_id',
          ],
          labOrderItems.length > 0
            ? labOrderItems.map((item: Record<string, unknown>) => {
                const order = labById.get(String(item.lab_order_id)) as
                  | Record<string, unknown>
                  | undefined;
                return {
                  lab_order_id: item.lab_order_id,
                  patient_id: order?.patient_id ?? '',
                  ordered_at: order?.ordered_at ?? '',
                  title: order?.title ?? '',
                  status: order?.status ?? '',
                  test_name: item.test_name,
                  result_value: item.result_value ?? '',
                  result_unit: item.unit ?? '',
                  reference_range: item.reference_range ?? '',
                  flag: item.flag ?? '',
                  source_record_id: order?.source_record_id ?? '',
                };
              })
            : labOrders.map((order: Record<string, unknown>) => ({
                lab_order_id: order.id,
                patient_id: order.patient_id,
                ordered_at: order.ordered_at,
                title: order.title,
                status: order.status,
                test_name: '',
                result_value: '',
                result_unit: '',
                reference_range: '',
                flag: '',
                source_record_id: order.source_record_id ?? '',
              }))
        );
      } else if (exportType === 'surgeries') {
        csv = toCsv(
          [
            'id',
            'patient_id',
            'procedure_name',
            'status',
            'scheduled_at',
            'notes',
            'source_record_id',
          ],
          surgeries
        );
      } else if (exportType === 'prescriptions') {
        const rxById = new Map(
          prescriptions.map((row: { id: string }) => [row.id, row] as const)
        );
        csv = toCsv(
          [
            'prescription_id',
            'patient_id',
            'prescribed_at',
            'status',
            'medication_name',
            'dose',
            'frequency',
            'duration',
            'route',
            'quantity',
            'instructions',
            'source_record_id',
          ],
          prescriptionItems.length > 0
            ? prescriptionItems.map((item: Record<string, unknown>) => {
                const rx = rxById.get(String(item.prescription_id)) as
                  | Record<string, unknown>
                  | undefined;
                return {
                  prescription_id: item.prescription_id,
                  patient_id: rx?.patient_id ?? '',
                  prescribed_at: rx?.prescribed_at ?? '',
                  status: rx?.status ?? '',
                  medication_name: item.medication_name,
                  dose: item.dose,
                  frequency: item.frequency,
                  duration: item.duration ?? '',
                  route: item.route ?? '',
                  quantity: item.quantity ?? '',
                  instructions: item.instructions ?? '',
                  source_record_id: rx?.source_record_id ?? '',
                };
              })
            : prescriptions.map((rx: Record<string, unknown>) => ({
                prescription_id: rx.id,
                patient_id: rx.patient_id,
                prescribed_at: rx.prescribed_at,
                status: rx.status,
                medication_name: '',
                dose: '',
                frequency: '',
                duration: '',
                route: '',
                quantity: '',
                instructions: '',
                source_record_id: rx.source_record_id ?? '',
              }))
        );
      } else if (exportType === 'hospitalizations') {
        csv = toCsv(
          [
            'id',
            'patient_id',
            'status',
            'admitted_at',
            'discharged_at',
            'reason',
            'diagnosis',
            'cage',
            'source_record_id',
          ],
          hospitalizations
        );
      } else {
        csv = toCsv(
          [
            'id',
            'patient_id',
            'entry_date',
            'entry_type',
            'title',
            'diagnosis',
            'treatment',
            'original_professional_name',
            'source_system',
          ],
          clinical
        );
      }

      if (job.format === 'csv') {
        body = csv;
        filename = `syncvete-export-${job.export_type}-${Date.now()}.csv`;
        contentType = 'text/csv;charset=utf-8';
      } else {
        const { csvTextToXlsxBase64 } = await import('./xlsx');
        const xlsx = csvTextToXlsxBase64(String(job.export_type), csv);
        body = Buffer.from(xlsx.base64, 'base64');
        filename = xlsx.filename;
        contentType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
    } else if (job.format === 'pdf') {
      const patient = filteredPatients[0] ?? {};
      const owner = filteredOwners[0] ?? null;
      body = buildClinicalPdfHtml({
        clinicName: org?.name ?? 'SyncVete',
        patient,
        owner,
        entries: clinical,
        vaccinations,
        labOrders,
        surgeries,
        prescriptions,
        prescriptionItems,
        hospitalizations,
        exportedAt: new Date().toISOString(),
      });
      filename = `syncvete-clinical-${String(patient.name ?? 'patient')}-${Date.now()}.html`;
      contentType = 'text/html;charset=utf-8';
    } else {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      const dataFolder = zip.folder('data');
      if (!specialtyOnly) {
        dataFolder?.file(
          'owners.csv',
          toCsv(
            [
              'id',
              'full_name',
              'document_type',
              'document_number',
              'phone',
              'email',
              'address',
              'city',
              'province',
              'postal_code',
              'notes',
              'source_system',
              'source_record_id',
            ],
            filteredOwners
          )
        );
        dataFolder?.file(
          'patients.csv',
          toCsv(
            [
              'id',
              'owner_id',
              'name',
              'species',
              'breed',
              'sex',
              'birth_date',
              'microchip',
              'color',
              'notes',
              'source_system',
              'source_record_id',
            ],
            filteredPatients
          )
        );
        dataFolder?.file(
          'clinical_records.csv',
          toCsv(
            [
              'id',
              'patient_id',
              'entry_date',
              'entry_type',
              'title',
              'anamnesis',
              'physical_exam',
              'diagnosis',
              'treatment',
              'plan',
              'original_professional_name',
              'source_system',
              'source_record_id',
            ],
            clinical
          )
        );
        dataFolder?.file(
          'vaccinations.csv',
          toCsv(
            [
              'id',
              'patient_id',
              'vaccine_name',
              'administered_at',
              'next_due_at',
              'manufacturer',
              'lot_number',
              'notes',
              'source_system',
              'source_record_id',
            ],
            vaccinations
          )
        );
      }

      dataFolder?.file(
        'lab_orders.csv',
        toCsv(
          [
            'id',
            'patient_id',
            'title',
            'status',
            'priority',
            'sample_type',
            'ordered_at',
            'interpretation',
            'notes',
            'source_system',
            'source_record_id',
          ],
          labOrders
        )
      );
      dataFolder?.file(
        'lab_order_items.csv',
        toCsv(
          [
            'id',
            'lab_order_id',
            'test_name',
            'result_value',
            'unit',
            'reference_range',
            'flag',
            'sort_order',
          ],
          labOrderItems
        )
      );
      dataFolder?.file(
        'surgeries.csv',
        toCsv(
          [
            'id',
            'patient_id',
            'procedure_name',
            'status',
            'scheduled_at',
            'notes',
            'source_system',
            'source_record_id',
          ],
          surgeries
        )
      );
      dataFolder?.file(
        'prescriptions.csv',
        toCsv(
          [
            'id',
            'patient_id',
            'status',
            'prescribed_at',
            'notes',
            'source_system',
            'source_record_id',
          ],
          prescriptions
        )
      );
      dataFolder?.file(
        'prescription_items.csv',
        toCsv(
          [
            'id',
            'prescription_id',
            'medication_name',
            'dose',
            'frequency',
            'duration',
            'route',
            'quantity',
            'instructions',
            'sort_order',
          ],
          prescriptionItems
        )
      );
      dataFolder?.file(
        'hospitalizations.csv',
        toCsv(
          [
            'id',
            'patient_id',
            'status',
            'admitted_at',
            'discharged_at',
            'reason',
            'diagnosis',
            'treatment_plan',
            'cage',
            'notes',
            'source_system',
            'source_record_id',
          ],
          hospitalizations
        )
      );

      if (specialtyRows && specialtyOnly) {
        dataFolder?.file(`${exportType}.json`, JSON.stringify(specialtyRows, null, 2));
      } else {
        dataFolder?.file('owners.json', JSON.stringify(filteredOwners, null, 2));
        dataFolder?.file('patients.json', JSON.stringify(filteredPatients, null, 2));
        dataFolder?.file('clinical-records.json', JSON.stringify(clinical, null, 2));
        dataFolder?.file('vaccinations.json', JSON.stringify(vaccinations, null, 2));
        dataFolder?.file('lab_orders.json', JSON.stringify(labOrders, null, 2));
        dataFolder?.file('lab_order_items.json', JSON.stringify(labOrderItems, null, 2));
        dataFolder?.file('surgeries.json', JSON.stringify(surgeries, null, 2));
        dataFolder?.file('prescriptions.json', JSON.stringify(prescriptions, null, 2));
        dataFolder?.file('prescription_items.json', JSON.stringify(prescriptionItems, null, 2));
        dataFolder?.file('hospitalizations.json', JSON.stringify(hospitalizations, null, 2));
      }

      const patientIds = filteredPatients.map((p: { id: string }) => p.id);
      const images =
        exportType === 'full_clinic' || exportType === 'patient_clinical'
          ? await fetchClinicalImages(organizationId, patientIds, supabase)
          : [];
      const storageResolved = options?.asService
        ? await (await import('@/lib/supabase/server')).createServiceClient()
        : await createServerClient();
      let attachmentCount = 0;
      let attachmentBytes = 0;
      const MAX_ATTACHMENTS = 40;
      const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
      for (const image of images) {
        if (attachmentCount >= MAX_ATTACHMENTS || attachmentBytes >= MAX_ATTACHMENT_BYTES) break;
        const { data: blob, error: downloadError } = await storageResolved.storage
          .from('clinical-images')
          .download(image.storage_path);
        if (downloadError || !blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (attachmentBytes + bytes.byteLength > MAX_ATTACHMENT_BYTES) break;
        const safeName = String(image.original_name || `${image.id}.bin`).replace(
          /[\\/:*?"<>|]+/g,
          '_'
        );
        zip
          .folder('attachments')
          ?.folder(String(image.patient_id))
          ?.file(safeName, bytes);
        attachmentCount += 1;
        attachmentBytes += bytes.byteLength;
      }
      recordCounts.attachments = attachmentCount;

      zip
        .folder('reports')
        ?.file(
          'export-summary.txt',
          `SyncVete export\nType: ${job.export_type}\nRange: ${bounds.dateFrom ?? '—'} → ${bounds.dateTo ?? '—'}\nOwners: ${recordCounts.owners}\nPatients: ${recordCounts.patients}\nClinical: ${recordCounts.clinicalEntries}\nVaccinations: ${recordCounts.vaccinations}\nLab: ${recordCounts.labOrders}\nLab items: ${recordCounts.labOrderItems}\nSurgeries: ${recordCounts.surgeries}\nPrescriptions: ${recordCounts.prescriptions}\nPrescription items: ${recordCounts.prescriptionItems}\nHospitalizations: ${recordCounts.hospitalizations}\nAttachments: ${attachmentCount}\n`
        );
      body = await zip.generateAsync({ type: 'uint8array' });
      filename = `SyncVete-Clinic-Export-${new Date().toISOString().slice(0, 10)}.zip`;
      contentType = 'application/zip';
    }

    // Persist artifact for later download / background jobs
    const storagePath = `${organizationId}/exports/${jobId}/${filename}`;
    const storageClient = options?.asService
      ? await (await import('@/lib/supabase/server')).createServiceClient()
      : await createServerClient();
    const uploadBytes =
      typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
    const { error: uploadError } = await storageClient.storage
      .from('data-migration')
      .upload(storagePath, uploadBytes, { contentType, upsert: true });
    if (uploadError) {
      // Non-fatal for interactive download; still return body
      console.warn('[export] artifact upload failed', uploadError.message);
    }

    await supabase
      .from('data_export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        record_counts: recordCounts,
        download_filename: filename,
        storage_path: uploadError ? null : storagePath,
        progress_message: 'Completado',
        metadata: { contentType, formatVersion: DATA_MIGRATION_FORMAT_VERSION },
      })
      .eq('id', jobId);

    const { logDataMigrationAudit } = await import('@/lib/data-migration/audit');
    await logDataMigrationAudit({
      organizationId,
      userId,
      action: 'data_export.completed',
      entityType: 'data_export_jobs',
      entityId: jobId,
      newData: { recordCounts, filename, format: job.format },
    });

    const { notifyDataMigrationEvent } = await import('@/lib/data-migration/notify');
    await notifyDataMigrationEvent({
      organizationId,
      title: 'Exportación lista',
      body: `${String(job.export_type)} · ${filename}`,
      relatedType: 'data_export_job',
      relatedId: jobId,
    });

    return { jobId, filename, contentType, body, recordCounts, storagePath: uploadError ? null : storagePath };
  } catch (err) {
    await supabase
      .from('data_export_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Export failed',
        completed_at: new Date().toISOString(),
        progress_message: 'Falló',
      })
      .eq('id', jobId);
    const { notifyDataMigrationEvent } = await import('@/lib/data-migration/notify');
    await notifyDataMigrationEvent({
      organizationId,
      title: 'Exportación fallida',
      body: err instanceof Error ? err.message : 'Export failed',
      relatedType: 'data_export_job',
      relatedId: jobId,
    });
    throw err;
  }
}

export async function getExportDownloadUrl(jobId: string) {
  const session = await requirePermission('data:export');
  const supabase = await migrationDb();
  const storage = await createServerClient();
  const { data: job, error } = await supabase
    .from('data_export_jobs')
    .select('id, storage_path, download_filename, status, organization_id')
    .eq('id', jobId)
    .eq('organization_id', session.organizationId)
    .single();
  if (error || !job) throw new Error(error?.message ?? 'Export no encontrado');
  if (job.status !== 'completed' || !job.storage_path) {
    throw new Error('El archivo aún no está disponible');
  }
  const { data, error: signedError } = await storage.storage
    .from('data-migration')
    .createSignedUrl(job.storage_path, 60 * 15);
  if (signedError || !data?.signedUrl) {
    throw new Error(signedError?.message ?? 'No se pudo firmar la descarga');
  }
  const { logDataMigrationAudit } = await import('@/lib/data-migration/audit');
  await logDataMigrationAudit({
    organizationId: session.organizationId,
    userId: session.userId,
    action: 'data_export.downloaded',
    entityType: 'data_export_jobs',
    entityId: jobId,
    newData: { filename: job.download_filename },
  });
  return {
    url: data.signedUrl,
    filename: String(job.download_filename ?? 'syncvete-export.bin'),
  };
}

export async function getImportBatchProgress(batchId: string) {
  const session = await requirePermission('data:import');
  const supabase = await migrationDb();
  const { data, error } = await supabase
    .from('data_import_batches')
    .select(
      'id, status, progress_processed, progress_total, progress_message, imported_records, failed_records, linked_records, skipped_records, error_message, queued_at, completed_at'
    )
    .eq('id', batchId)
    .eq('organization_id', session.organizationId)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Lote no encontrado');
  return data;
}

export async function processNextQueuedExportJobs(options?: { maxJobs?: number }) {
  const maxJobs = options?.maxJobs ?? 2;
  const { createServiceClient } = await import('@/lib/supabase/server');
  const service = (await createServiceClient()) as unknown as Awaited<ReturnType<typeof migrationDb>>;
  const { data: jobs, error } = await service
    .from('data_export_jobs')
    .select('id')
    .eq('status', 'queued')
    .not('queued_at', 'is', null)
    .order('queued_at', { ascending: true })
    .limit(maxJobs);
  if (error) throw new Error(error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const job of (jobs ?? []) as Array<{ id: string }>) {
    const { data: fullJob } = await service
      .from('data_export_jobs')
      .select('id, organization_id, status')
      .eq('id', job.id)
      .maybeSingle();
    if (!fullJob || fullJob.status !== 'queued') {
      results.push({ jobId: job.id, skipped: 'not_queued' });
      continue;
    }
    const { count: activeCount } = await service
      .from('data_export_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', fullJob.organization_id)
      .eq('status', 'running')
      .neq('id', job.id);
    if ((activeCount ?? 0) > 0) {
      results.push({ jobId: job.id, skipped: 'org_busy' });
      continue;
    }
    try {
      const result = await runExportJob(String(job.id), { asService: true });
      results.push({
        jobId: result.jobId,
        filename: result.filename,
        recordCounts: result.recordCounts,
      });
    } catch (err) {
      results.push({
        jobId: job.id,
        error: err instanceof Error ? err.message : 'export_failed',
      });
    }
  }
  return { processedJobs: results.length, results };
}
