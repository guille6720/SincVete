import 'server-only';

import {
  DATA_MIGRATION_FORMAT,
  DATA_MIGRATION_FORMAT_VERSION,
  toCsv,
  type ExportFormat,
  type ExportType,
} from '@sincvete/shared';
import JSZip from 'jszip';
import { createServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';

async function migrationDb() {
  return (await createServerClient()) as unknown as { from: (table: string) => any };
}

const EXPORT_RETENTION_DAYS = 7;

export async function createExportJob(input: {
  exportType: ExportType;
  format: ExportFormat;
  patientId?: string | null;
}) {
  const session = await requirePermission('data:export');
  const supabase = await migrationDb();
  const expires = new Date();
  expires.setDate(expires.getDate() + EXPORT_RETENTION_DAYS);

  const { data, error } = await supabase
    .from('data_export_jobs')
    .insert({
      organization_id: session.organizationId,
      export_type: input.exportType,
      format: input.format,
      status: 'queued',
      created_by: session.userId,
      patient_id: input.patientId ?? null,
      expires_at: expires.toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
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

async function fetchOwners(organizationId: string) {
  const supabase = await migrationDb();
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

async function fetchPatients(organizationId: string) {
  const supabase = await migrationDb();
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

async function fetchClinicalEntries(organizationId: string, patientId?: string | null) {
  const supabase = await migrationDb();
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
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchVaccinations(organizationId: string, patientId?: string | null) {
  const supabase = await migrationDb();
  let query = supabase
    .from('vaccinations')
    .select(
      'id, patient_id, owner_id, vaccine_name, administered_at, next_due_at, lot_number, notes, created_at'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('administered_at', { ascending: true })
    .limit(10000);
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function buildClinicalPdfHtml(input: {
  clinicName: string;
  patient: Record<string, unknown>;
  owner: Record<string, unknown> | null;
  entries: Array<Record<string, unknown>>;
  vaccinations: Array<Record<string, unknown>>;
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
</body>
</html>`;
}

export async function runExportJob(jobId: string): Promise<{
  jobId: string;
  filename: string;
  contentType: string;
  body: string | Uint8Array;
  recordCounts: Record<string, number>;
}> {
  const session = await requirePermission('data:export');
  const supabase = await migrationDb();
  const { data: job, error } = await supabase
    .from('data_export_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', session.organizationId)
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
      .eq('id', session.organizationId)
      .single();

    const owners = job.export_type === 'patients' ? [] : await fetchOwners(session.organizationId);
    const patients =
      job.export_type === 'owners' && !job.patient_id
        ? []
        : await fetchPatients(session.organizationId);
    const clinical =
      job.export_type === 'owners'
        ? []
        : await fetchClinicalEntries(session.organizationId, job.patient_id);
    const vaccinations =
      job.export_type === 'owners'
        ? []
        : await fetchVaccinations(session.organizationId, job.patient_id);

    const filteredPatients = job.patient_id
      ? patients.filter((p: { id: string }) => p.id === job.patient_id)
      : patients;
    const filteredOwners =
      job.patient_id && filteredPatients[0]
        ? owners.filter((o: { id: string }) => o.id === filteredPatients[0]!.owner_id)
        : owners;

    const recordCounts = {
      owners: filteredOwners.length,
      patients: filteredPatients.length,
      clinicalEntries: clinical.length,
      vaccinations: vaccinations.length,
    };

    const manifest = {
      format: DATA_MIGRATION_FORMAT,
      version: DATA_MIGRATION_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      organizationId: session.organizationId,
      organizationName: org?.name ?? null,
      exportType: job.export_type,
      generatedBy: session.userId,
      entities: recordCounts,
    };

    let body: string | Uint8Array;
    let filename: string;
    let contentType: string;

    if (job.format === 'json') {
      body = JSON.stringify(
        {
          manifest,
          owners: filteredOwners,
          patients: filteredPatients,
          clinicalEntries: clinical,
          vaccinations,
        },
        null,
        2
      );
      filename = `syncvete-export-${job.export_type}-${Date.now()}.json`;
      contentType = 'application/json;charset=utf-8';
    } else if (job.format === 'csv') {
      if (job.export_type === 'owners') {
        body = toCsv(
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
      } else if (job.export_type === 'patients') {
        body = toCsv(
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
      } else {
        body = toCsv(
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
      filename = `syncvete-export-${job.export_type}-${Date.now()}.csv`;
      contentType = 'text/csv;charset=utf-8';
    } else if (job.format === 'pdf') {
      const patient = filteredPatients[0] ?? {};
      const owner = filteredOwners[0] ?? null;
      body = buildClinicalPdfHtml({
        clinicName: org?.name ?? 'SyncVete',
        patient,
        owner,
        entries: clinical,
        vaccinations,
        exportedAt: new Date().toISOString(),
      });
      filename = `syncvete-clinical-${String(patient.name ?? 'patient')}-${Date.now()}.html`;
      contentType = 'text/html;charset=utf-8';
    } else {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.folder('data')?.file('owners.json', JSON.stringify(filteredOwners, null, 2));
      zip.folder('data')?.file('patients.json', JSON.stringify(filteredPatients, null, 2));
      zip.folder('data')?.file('clinical-records.json', JSON.stringify(clinical, null, 2));
      zip.folder('data')?.file('vaccinations.json', JSON.stringify(vaccinations, null, 2));
      zip
        .folder('reports')
        ?.file(
          'export-summary.txt',
          `SyncVete export\nType: ${job.export_type}\nOwners: ${recordCounts.owners}\nPatients: ${recordCounts.patients}\nClinical: ${recordCounts.clinicalEntries}\nVaccinations: ${recordCounts.vaccinations}\n`
        );
      body = await zip.generateAsync({ type: 'uint8array' });
      filename = `SyncVete-Clinic-Export-${new Date().toISOString().slice(0, 10)}.zip`;
      contentType = 'application/zip';
    }

    await supabase
      .from('data_export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        record_counts: recordCounts,
        download_filename: filename,
        metadata: { contentType, formatVersion: DATA_MIGRATION_FORMAT_VERSION },
      })
      .eq('id', jobId);

    return { jobId, filename, contentType, body, recordCounts };
  } catch (err) {
    await supabase
      .from('data_export_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Export failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    throw err;
  }
}
