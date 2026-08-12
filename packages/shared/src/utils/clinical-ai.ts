import {
  CLINICAL_AI_SYSTEM_PROMPT,
  type ClinicalAiKind,
} from '../constants/clinical-ai';
import type {
  ClinicalAiContext,
  ClinicalAiContextEntry,
  ClinicalAiOwnerInstructions,
  ClinicalAiPatientSummary,
  ClinicalAiSoapAssist,
  ClinicalAiSoapSnapshot,
} from '../types/clinical-ai';

export function hashClinicalAiPrompt(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function truncateClinicalAiText(
  value: string | null | undefined,
  max = 800
): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? trimmed).trim();

  const tryParse = (value: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return tryParse(text.slice(start, end + 1));
  }
  return null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

export function parsePatientSummaryOutput(raw: unknown): ClinicalAiPatientSummary | null {
  const data =
    typeof raw === 'string' ? extractJsonObject(raw) : (raw as Record<string, unknown> | null);
  if (!data) return null;
  const summary = str(data.summary ?? data.resumen);
  if (!summary) return null;
  return {
    summary,
    alerts: stringList(data.alerts ?? data.alertas),
    lastDiagnoses: stringList(data.lastDiagnoses ?? data.last_diagnoses ?? data.diagnosticos),
    pending: stringList(data.pending ?? data.pendientes),
  };
}

export function parseSoapAssistOutput(raw: unknown): ClinicalAiSoapAssist | null {
  const data =
    typeof raw === 'string' ? extractJsonObject(raw) : (raw as Record<string, unknown> | null);
  if (!data) return null;
  const diagnosis = str(data.diagnosis ?? data.diagnostico);
  const treatment = str(data.treatment ?? data.tratamiento);
  const plan = str(data.plan);
  if (!diagnosis || !treatment || !plan) return null;
  return {
    diagnosis,
    differentials: stringList(data.differentials ?? data.diferenciales),
    treatment,
    plan,
  };
}

export function parseOwnerInstructionsOutput(raw: unknown): ClinicalAiOwnerInstructions | null {
  const data =
    typeof raw === 'string' ? extractJsonObject(raw) : (raw as Record<string, unknown> | null);
  if (!data) return null;
  const title = str(data.title ?? data.titulo);
  const body = str(data.body ?? data.cuerpo ?? data.mensaje);
  if (!title || !body) return null;
  return { title, body };
}

export function parseClinicalAiOutput(kind: ClinicalAiKind, raw: unknown) {
  if (kind === 'patient_summary') return parsePatientSummaryOutput(raw);
  if (kind === 'soap_assist') return parseSoapAssistOutput(raw);
  return parseOwnerInstructionsOutput(raw);
}

function formatEntry(entry: ClinicalAiContextEntry): string {
  const parts = [
    `${entry.entry_date.slice(0, 10)} · ${entry.entry_type}${entry.title ? ` · ${entry.title}` : ''}`,
    entry.anamnesis ? `Anamnesis: ${truncateClinicalAiText(entry.anamnesis, 400)}` : '',
    entry.physical_exam ? `Examen: ${truncateClinicalAiText(entry.physical_exam, 400)}` : '',
    entry.diagnosis ? `Dx: ${truncateClinicalAiText(entry.diagnosis, 240)}` : '',
    entry.treatment ? `Tx: ${truncateClinicalAiText(entry.treatment, 240)}` : '',
    entry.plan ? `Plan: ${truncateClinicalAiText(entry.plan, 240)}` : '',
    entry.weight_kg != null ? `Peso: ${entry.weight_kg} kg` : '',
    entry.temperature_c != null ? `Temp: ${entry.temperature_c} °C` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

export function formatClinicalAiContext(context: ClinicalAiContext): string {
  const patient = context.patient;
  if (!patient) return 'Sin paciente.';

  const header = [
    `Paciente: ${patient.name}`,
    `Especie: ${patient.species}`,
    patient.breed ? `Raza: ${patient.breed}` : '',
    patient.sex ? `Sexo: ${patient.sex}` : '',
    patient.birth_date ? `Nacimiento: ${patient.birth_date}` : '',
    `Castrado/a: ${patient.is_neutered ? 'sí' : 'no'}`,
    `Tutor: ${patient.owner_name}`,
  ]
    .filter(Boolean)
    .join('\n');

  const entries =
    context.entries.length > 0
      ? context.entries.map(formatEntry).join('\n---\n')
      : 'Sin entradas clínicas previas.';

  const vaccines =
    context.vaccinations.length > 0
      ? context.vaccinations
          .map((item) => {
            const due = item.next_due_at ? ` · próximo ${item.next_due_at}` : '';
            return `${item.vaccine_name} (${item.administered_at.slice(0, 10)}${due})`;
          })
          .join('\n')
      : 'Sin vacunas registradas.';

  return `${header}\n\nHistoria reciente:\n${entries}\n\nVacunas:\n${vaccines}`;
}

export function formatSoapSnapshot(snapshot?: ClinicalAiSoapSnapshot | null): string {
  if (!snapshot) return '';
  const parts = [
    snapshot.title ? `Motivo: ${truncateClinicalAiText(snapshot.title, 200)}` : '',
    snapshot.anamnesis ? `Anamnesis: ${truncateClinicalAiText(snapshot.anamnesis)}` : '',
    snapshot.physicalExam ? `Examen: ${truncateClinicalAiText(snapshot.physicalExam)}` : '',
    snapshot.diagnosis ? `Dx actual: ${truncateClinicalAiText(snapshot.diagnosis, 400)}` : '',
    snapshot.treatment ? `Tx actual: ${truncateClinicalAiText(snapshot.treatment, 400)}` : '',
    snapshot.plan ? `Plan actual: ${truncateClinicalAiText(snapshot.plan, 400)}` : '',
    snapshot.notes ? `Notas: ${truncateClinicalAiText(snapshot.notes, 400)}` : '',
    snapshot.weightKg != null ? `Peso: ${snapshot.weightKg} kg` : '',
    snapshot.temperatureC != null ? `Temp: ${snapshot.temperatureC} °C` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

export function buildClinicalAiUserPrompt(input: {
  kind: ClinicalAiKind;
  context: ClinicalAiContext;
  snapshot?: ClinicalAiSoapSnapshot | null;
  notes?: string | null;
}): { system: string; user: string } {
  const context = formatClinicalAiContext(input.context);
  const snapshot = formatSoapSnapshot(input.snapshot);
  const notes = truncateClinicalAiText(input.notes, 1200);
  const extra = [snapshot, notes ? `Notas del veterinario:\n${notes}` : '']
    .filter(Boolean)
    .join('\n\n');

  let task = '';
  if (input.kind === 'patient_summary') {
    task =
      'Generá un resumen clínico del paciente. JSON con claves: ' +
      'summary (string), alerts (string[]), lastDiagnoses (string[]), pending (string[]).';
  } else if (input.kind === 'soap_assist') {
    task =
      'Sugerí diagnóstico, diferenciales, tratamiento y plan a partir del contexto y la consulta actual. ' +
      'JSON con claves: diagnosis (string), differentials (string[]), treatment (string), plan (string).';
  } else {
    task =
      'Redactá indicaciones claras para el tutor (cuidados en casa, signos de alarma, próxima visita). ' +
      'JSON con claves: title (string), body (string, máx 1200 caracteres, tono cercano).';
  }

  const user = [task, context, extra].filter(Boolean).join('\n\n');
  return { system: CLINICAL_AI_SYSTEM_PROMPT, user };
}

export function clinicalAiExcerpt(userPrompt: string): string {
  return truncateClinicalAiText(userPrompt, 2000);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function strOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

export function parsePatientClinicalContext(raw: unknown): ClinicalAiContext | null {
  const data = asRecord(raw);
  if (!data) return null;
  const patientRaw = asRecord(data.patient);
  if (!patientRaw || !strOrNull(patientRaw.id) || !strOrNull(patientRaw.name)) return null;

  const entries = Array.isArray(data.entries) ? data.entries : [];
  const vaccinations = Array.isArray(data.vaccinations) ? data.vaccinations : [];

  return {
    patient: {
      id: String(patientRaw.id),
      name: String(patientRaw.name),
      species: strOrNull(patientRaw.species) ?? 'Otro',
      breed: strOrNull(patientRaw.breed),
      sex: strOrNull(patientRaw.sex),
      birth_date: strOrNull(patientRaw.birth_date),
      is_neutered: bool(patientRaw.is_neutered),
      is_deceased: bool(patientRaw.is_deceased),
      owner_id: strOrNull(patientRaw.owner_id) ?? '',
      owner_name: strOrNull(patientRaw.owner_name) ?? '',
    },
    entries: entries
      .map((item): ClinicalAiContextEntry | null => {
        const row = asRecord(item);
        if (!row || !strOrNull(row.id)) return null;
        return {
          id: String(row.id),
          entry_date: strOrNull(row.entry_date) ?? '',
          entry_type: strOrNull(row.entry_type) ?? 'consulta',
          title: strOrNull(row.title),
          anamnesis: strOrNull(row.anamnesis),
          physical_exam: strOrNull(row.physical_exam),
          diagnosis: strOrNull(row.diagnosis),
          treatment: strOrNull(row.treatment),
          plan: strOrNull(row.plan),
          weight_kg: numOrNull(row.weight_kg),
          temperature_c: numOrNull(row.temperature_c),
        };
      })
      .filter((item): item is ClinicalAiContextEntry => item !== null),
    vaccinations: vaccinations
      .map((item) => {
        const row = asRecord(item);
        if (!row || !strOrNull(row.vaccine_name)) return null;
        return {
          vaccine_name: String(row.vaccine_name),
          administered_at: strOrNull(row.administered_at) ?? '',
          next_due_at: strOrNull(row.next_due_at),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
}
