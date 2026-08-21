/** SyncVete data import/export — pure helpers (no DB I/O). */

export const DATA_MIGRATION_FORMAT_VERSION = '1.0';
export const DATA_MIGRATION_FORMAT = 'syncvete-migration';

export const IMPORT_TYPES = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'lab_orders',
  'surgeries',
  'prescriptions',
  'hospitalizations',
  'attachments',
  'full_migration',
  'migration_zip',
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  owners: 'Propietarios',
  patients: 'Pacientes',
  clinical_entries: 'Historias clínicas',
  vaccinations: 'Vacunaciones',
  lab_orders: 'Laboratorio',
  surgeries: 'Cirugías',
  prescriptions: 'Recetas / farmacia',
  hospitalizations: 'Internaciones',
  attachments: 'Adjuntos (ZIP)',
  full_migration: 'Migración completa (guiada)',
  migration_zip: 'Paquete ZIP SyncVete',
};

export const IMPORT_ENTITY_TYPES = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'lab_orders',
  'surgeries',
  'prescriptions',
  'hospitalizations',
] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export const DEFAULT_IMPORT_CHUNK_SIZE = 50;

/** Hard caps for clinic uploads (fase 11). */
export const MAX_IMPORT_CSV_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_ZIP_BYTES = 80 * 1024 * 1024;
export const MAX_EXPORT_ARTIFACT_BYTES = 200 * 1024 * 1024;

/** Ordered steps for guided full clinic migration (fase 6). */
export const FULL_MIGRATION_STEPS = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'lab_orders',
  'surgeries',
  'prescriptions',
  'hospitalizations',
  'attachments',
] as const;
export type FullMigrationStep = (typeof FULL_MIGRATION_STEPS)[number];

export const FULL_MIGRATION_STEP_LABELS: Record<FullMigrationStep, string> = {
  owners: '1. Propietarios',
  patients: '2. Pacientes',
  clinical_entries: '3. Historias clínicas',
  vaccinations: '4. Vacunaciones',
  lab_orders: '5. Laboratorio',
  surgeries: '6. Cirugías',
  prescriptions: '7. Recetas',
  hospitalizations: '8. Internaciones',
  attachments: '9. Adjuntos ZIP',
};

export function nextFullMigrationStep(current: FullMigrationStep): FullMigrationStep | null {
  const idx = FULL_MIGRATION_STEPS.indexOf(current);
  if (idx < 0 || idx >= FULL_MIGRATION_STEPS.length - 1) return null;
  return FULL_MIGRATION_STEPS[idx + 1] ?? null;
}

export function previousFullMigrationStep(current: FullMigrationStep): FullMigrationStep | null {
  const idx = FULL_MIGRATION_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return FULL_MIGRATION_STEPS[idx - 1] ?? null;
}

export const DATA_MIGRATION_AUDIT_ACTIONS = {
  importCompleted: 'data_import.completed',
  importRolledBack: 'data_import.rolled_back',
  importQueued: 'data_import.queued',
  importCancelled: 'data_import.cancelled',
  importRetried: 'data_import.retried',
  exportCompleted: 'data_export.completed',
  exportQueued: 'data_export.queued',
  exportCancelled: 'data_export.cancelled',
  exportDownloaded: 'data_export.downloaded',
} as const;

export const IDEMPOTENCY_MODES = ['off', 'skip_existing_source'] as const;
export type IdempotencyMode = (typeof IDEMPOTENCY_MODES)[number];

export const IDEMPOTENCY_MODE_LABELS: Record<IdempotencyMode, string> = {
  off: 'Sin idempotencia (crear según decisiones)',
  skip_existing_source: 'Omitir si ya existe source_record_id en el tenant',
};

export const EXPORT_TYPES = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'lab_orders',
  'surgeries',
  'prescriptions',
  'hospitalizations',
  'patient_clinical',
  'full_clinic',
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  owners: 'Propietarios',
  patients: 'Pacientes',
  clinical_entries: 'Historias clínicas',
  vaccinations: 'Vacunaciones',
  lab_orders: 'Laboratorio (con ítems)',
  surgeries: 'Cirugías',
  prescriptions: 'Recetas (con ítems)',
  hospitalizations: 'Internaciones',
  patient_clinical: 'Historia de un paciente',
  full_clinic: 'Exportación completa de la clínica',
};

export const SPECIALTY_EXPORT_TYPES = [
  'lab_orders',
  'surgeries',
  'prescriptions',
  'hospitalizations',
] as const;
export type SpecialtyExportType = (typeof SPECIALTY_EXPORT_TYPES)[number];

export function isSpecialtyExportType(value: string): value is SpecialtyExportType {
  return (SPECIALTY_EXPORT_TYPES as readonly string[]).includes(value);
}

/** Inclusive YYYY-MM-DD range; returns null bounds when empty/invalid. */
export function normalizeExportDateRange(input?: {
  dateFrom?: string | null;
  dateTo?: string | null;
}): { dateFrom: string | null; dateTo: string | null } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const dateFrom = input?.dateFrom && iso.test(input.dateFrom) ? input.dateFrom : null;
  const dateTo = input?.dateTo && iso.test(input.dateTo) ? input.dateTo : null;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { dateFrom: dateTo, dateTo: dateFrom };
  }
  return { dateFrom, dateTo };
}

export const EXPORT_FORMATS = ['csv', 'json', 'xlsx', 'pdf', 'zip'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const DATE_LOCALES = ['es-AR', 'en-US', 'iso'] as const;
export type DateLocale = (typeof DATE_LOCALES)[number];

export const CONFLICT_POLICIES = ['create', 'link', 'skip', 'review'] as const;
export type ConflictPolicy = (typeof CONFLICT_POLICIES)[number];

export const CONFLICT_DECISION_LABELS: Record<ConflictPolicy, string> = {
  create: 'Crear nuevo',
  link: 'Vincular existente',
  skip: 'Omitir fila',
  review: 'Revisar',
};

export type ImportFieldDef = {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

export const OWNER_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_owner_id',
    label: 'ID externo propietario',
    required: true,
    aliases: ['external_owner_id', 'owner_id', 'id_externo', 'codigo', 'código'],
  },
  {
    key: 'full_name',
    label: 'Nombre completo',
    required: true,
    aliases: ['full_name', 'nombre_completo', 'nombre', 'name', 'owner', 'propietario', 'tutor'],
  },
  {
    key: 'document_type',
    label: 'Tipo documento',
    aliases: ['document_type', 'tipo_documento', 'tipo_doc'],
  },
  {
    key: 'document_number',
    label: 'Número documento',
    aliases: ['document_number', 'documento', 'dni', 'cuit', 'doc'],
  },
  {
    key: 'phone',
    label: 'Teléfono',
    aliases: ['phone', 'telefono', 'teléfono', 'celular', 'mobile', 'tel'],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'correo', 'mail', 'e-mail'],
  },
  {
    key: 'address',
    label: 'Dirección',
    aliases: ['address', 'direccion', 'dirección', 'domicilio'],
  },
  {
    key: 'city',
    label: 'Ciudad',
    aliases: ['city', 'ciudad', 'localidad'],
  },
  {
    key: 'province',
    label: 'Provincia',
    aliases: ['province', 'provincia'],
  },
  {
    key: 'postal_code',
    label: 'Código postal',
    aliases: ['postal_code', 'cp', 'codigo_postal', 'código_postal'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas', 'observaciones'],
  },
];

export const PATIENT_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente', 'codigo_paciente'],
  },
  {
    key: 'external_owner_id',
    label: 'ID externo propietario',
    required: true,
    aliases: ['external_owner_id', 'owner_id', 'id_propietario', 'propietario_id'],
  },
  {
    key: 'name',
    label: 'Nombre paciente',
    required: true,
    aliases: ['name', 'nombre', 'mascota', 'paciente', 'patient'],
  },
  {
    key: 'species',
    label: 'Especie',
    required: true,
    aliases: ['species', 'especie'],
  },
  {
    key: 'breed',
    label: 'Raza',
    aliases: ['breed', 'raza'],
  },
  {
    key: 'sex',
    label: 'Sexo',
    aliases: ['sex', 'sexo', 'genero', 'género'],
  },
  {
    key: 'birth_date',
    label: 'Fecha nacimiento',
    aliases: ['birth_date', 'fecha_nacimiento', 'nacimiento', 'dob'],
  },
  {
    key: 'microchip',
    label: 'Microchip',
    aliases: ['microchip', 'chip'],
  },
  {
    key: 'color',
    label: 'Color',
    aliases: ['color', 'pelaje'],
  },
  {
    key: 'weight_kg',
    label: 'Peso (kg)',
    aliases: ['weight', 'weight_kg', 'peso'],
  },
  {
    key: 'status',
    label: 'Estado',
    aliases: ['status', 'estado'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas'],
  },
];

export const CLINICAL_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_clinical_record_id',
    label: 'ID externo registro',
    required: true,
    aliases: ['external_clinical_record_id', 'clinical_id', 'record_id', 'id_historia'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'original_date',
    label: 'Fecha original',
    required: true,
    aliases: ['original_date', 'entry_date', 'fecha', 'fecha_original', 'date'],
  },
  {
    key: 'original_veterinarian',
    label: 'Profesional original',
    aliases: ['original_veterinarian', 'veterinario', 'profesional', 'doctor'],
  },
  {
    key: 'record_type',
    label: 'Tipo de registro',
    aliases: ['record_type', 'entry_type', 'tipo', 'tipo_registro'],
  },
  {
    key: 'reason',
    label: 'Motivo / título',
    aliases: ['reason', 'title', 'motivo', 'titulo', 'título'],
  },
  {
    key: 'anamnesis',
    label: 'Anamnesis',
    aliases: ['anamnesis', 'anamnese', 'historia'],
  },
  {
    key: 'clinical_findings',
    label: 'Examen clínico',
    aliases: ['clinical_findings', 'physical_exam', 'examen', 'hallazgos'],
  },
  {
    key: 'diagnosis',
    label: 'Diagnóstico',
    aliases: ['diagnosis', 'diagnostico', 'diagnóstico'],
  },
  {
    key: 'treatment',
    label: 'Tratamiento',
    aliases: ['treatment', 'tratamiento'],
  },
  {
    key: 'observations',
    label: 'Observaciones / plan',
    aliases: ['observations', 'plan', 'observaciones', 'notas'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export const VACCINATION_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_vaccination_id',
    label: 'ID externo vacunación',
    required: true,
    aliases: ['external_vaccination_id', 'vaccination_id', 'id_vacuna', 'id_vacunacion'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'vaccine_name',
    label: 'Vacuna',
    required: true,
    aliases: ['vaccine_name', 'vacuna', 'nombre_vacuna'],
  },
  {
    key: 'administered_at',
    label: 'Fecha aplicación',
    required: true,
    aliases: ['administered_at', 'fecha', 'fecha_aplicacion', 'application_date'],
  },
  {
    key: 'next_due_at',
    label: 'Próxima dosis',
    aliases: ['next_due_at', 'proxima', 'próxima', 'next_due'],
  },
  {
    key: 'manufacturer',
    label: 'Laboratorio',
    aliases: ['manufacturer', 'laboratorio', 'fabricante'],
  },
  {
    key: 'lot_number',
    label: 'Lote',
    aliases: ['lot_number', 'lote', 'lot'],
  },
  {
    key: 'original_veterinarian',
    label: 'Profesional original',
    aliases: ['original_veterinarian', 'veterinario', 'profesional'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas', 'observaciones'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export const LAB_ORDER_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_lab_order_id',
    label: 'ID externo lab',
    required: true,
    aliases: ['external_lab_order_id', 'lab_order_id', 'id_lab', 'id_laboratorio'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'ordered_at',
    label: 'Fecha solicitud',
    required: true,
    aliases: ['ordered_at', 'fecha', 'fecha_solicitud', 'order_date'],
  },
  {
    key: 'title',
    label: 'Título / estudio',
    required: true,
    aliases: ['title', 'estudio', 'titulo', 'título', 'test'],
  },
  {
    key: 'tests',
    label: 'Tests (separados por |)',
    aliases: ['tests', 'items', 'analisis', 'análisis'],
  },
  {
    key: 'priority',
    label: 'Prioridad',
    aliases: ['priority', 'prioridad'],
  },
  {
    key: 'sample_type',
    label: 'Tipo de muestra',
    aliases: ['sample_type', 'muestra', 'tipo_muestra'],
  },
  {
    key: 'interpretation',
    label: 'Interpretación',
    aliases: ['interpretation', 'interpretacion', 'interpretación', 'resultado'],
  },
  {
    key: 'original_veterinarian',
    label: 'Profesional original',
    aliases: ['original_veterinarian', 'veterinario', 'profesional'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas', 'observaciones'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export const SURGERY_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_surgery_id',
    label: 'ID externo cirugía',
    required: true,
    aliases: ['external_surgery_id', 'surgery_id', 'id_cirugia', 'id_cirugía'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'scheduled_at',
    label: 'Fecha cirugía',
    required: true,
    aliases: ['scheduled_at', 'fecha', 'surgery_date', 'fecha_cirugia'],
  },
  {
    key: 'procedure_name',
    label: 'Procedimiento',
    required: true,
    aliases: ['procedure_name', 'procedimiento', 'cirugia', 'cirugía', 'surgery'],
  },
  {
    key: 'diagnosis',
    label: 'Diagnóstico',
    aliases: ['diagnosis', 'diagnostico', 'diagnóstico'],
  },
  {
    key: 'anesthesia',
    label: 'Anestesia',
    aliases: ['anesthesia', 'anestesia'],
  },
  {
    key: 'asa',
    label: 'ASA',
    aliases: ['asa'],
  },
  {
    key: 'original_veterinarian',
    label: 'Cirujano original',
    aliases: ['original_veterinarian', 'cirujano', 'surgeon', 'veterinario'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas', 'postop', 'observaciones'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export const PRESCRIPTION_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_prescription_id',
    label: 'ID externo receta',
    required: true,
    aliases: ['external_prescription_id', 'prescription_id', 'id_receta'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'prescribed_at',
    label: 'Fecha prescrita',
    required: true,
    aliases: ['prescribed_at', 'fecha', 'prescription_date', 'fecha_receta'],
  },
  {
    key: 'medication_name',
    label: 'Medicamento',
    required: true,
    aliases: ['medication_name', 'medicamento', 'drug', 'farmaco', 'fármaco'],
  },
  {
    key: 'dose',
    label: 'Dosis',
    required: true,
    aliases: ['dose', 'dosis'],
  },
  {
    key: 'frequency',
    label: 'Frecuencia',
    required: true,
    aliases: ['frequency', 'frecuencia'],
  },
  {
    key: 'duration',
    label: 'Duración',
    aliases: ['duration', 'duracion', 'duración'],
  },
  {
    key: 'route',
    label: 'Vía',
    aliases: ['route', 'via', 'vía'],
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    aliases: ['quantity', 'cantidad'],
  },
  {
    key: 'instructions',
    label: 'Indicaciones',
    aliases: ['instructions', 'indicaciones', 'posologia', 'posología'],
  },
  {
    key: 'original_veterinarian',
    label: 'Profesional original',
    aliases: ['original_veterinarian', 'veterinario', 'profesional'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export const HOSPITALIZATION_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'external_hospitalization_id',
    label: 'ID externo internación',
    required: true,
    aliases: ['external_hospitalization_id', 'hospitalization_id', 'id_internacion', 'id_internación'],
  },
  {
    key: 'external_patient_id',
    label: 'ID externo paciente',
    required: true,
    aliases: ['external_patient_id', 'patient_id', 'id_paciente'],
  },
  {
    key: 'admitted_at',
    label: 'Fecha ingreso',
    required: true,
    aliases: ['admitted_at', 'fecha_ingreso', 'ingreso', 'admission_date'],
  },
  {
    key: 'discharged_at',
    label: 'Fecha alta',
    aliases: ['discharged_at', 'fecha_alta', 'alta', 'discharge_date'],
  },
  {
    key: 'reason',
    label: 'Motivo',
    required: true,
    aliases: ['reason', 'motivo', 'reason_for_admission'],
  },
  {
    key: 'diagnosis',
    label: 'Diagnóstico',
    aliases: ['diagnosis', 'diagnostico', 'diagnóstico'],
  },
  {
    key: 'treatment_plan',
    label: 'Plan de tratamiento',
    aliases: ['treatment_plan', 'tratamiento', 'plan'],
  },
  {
    key: 'cage',
    label: 'Jaula / box',
    aliases: ['cage', 'jaula', 'box'],
  },
  {
    key: 'status',
    label: 'Estado',
    aliases: ['status', 'estado'],
  },
  {
    key: 'original_veterinarian',
    label: 'Profesional original',
    aliases: ['original_veterinarian', 'veterinario', 'profesional'],
  },
  {
    key: 'notes',
    label: 'Notas',
    aliases: ['notes', 'notas', 'observaciones'],
  },
  {
    key: 'source_system',
    label: 'Sistema origen',
    aliases: ['source_system', 'sistema', 'origen'],
  },
];

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

export function autoMapColumns(
  headers: string[],
  fields: ImportFieldDef[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const field of fields) {
    const aliasSet = new Set(field.aliases.map(normalizeHeader));
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return aliasSet.has(normalized) && !used.has(header);
    });
    mapping[field.key] = match ?? null;
    if (match) used.add(match);
  }
  return mapping;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]!).map((h) => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').replace(/^"|"$/g, '');
    });
    return row;
  });
  return { headers, rows };
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export type ParsedDate =
  | { ok: true; isoDate: string }
  | { ok: false; reason: 'empty' | 'ambiguous' | 'invalid' };

export function parseImportDate(raw: string | null | undefined, locale: DateLocale): ParsedDate {
  const value = (raw ?? '').trim();
  if (!value) return { ok: false, reason: 'empty' };

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'invalid' };
    return { ok: true, isoDate: value };
  }

  const slash = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const year = Number(slash[3]);
    if (locale === 'iso') return { ok: false, reason: 'invalid' };
    if (locale === 'en-US') {
      if (a > 12) return { ok: false, reason: 'invalid' };
      const iso = `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      return { ok: true, isoDate: iso };
    }
    // es-AR: DD/MM/YYYY — if both <= 12 and different, still use locale (not silent guess flip)
    if (b > 12) return { ok: false, reason: 'invalid' };
    if (a > 31) return { ok: false, reason: 'invalid' };
    const iso = `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'invalid' };
    return { ok: true, isoDate: iso };
  }

  return { ok: false, reason: 'invalid' };
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeDocument(value: string): string {
  return value.replace(/[.\-\s]/g, '').toUpperCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

export type ValidationIssue = {
  rowNumber: number;
  entityType: string;
  field?: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  recommendedAction?: string;
  sourceReference?: string;
  /** Existing SyncVete row to link when decision=link */
  matchInternalId?: string;
};

export type RowConflictDecision = {
  rowNumber: number;
  decision: ConflictPolicy;
  linkInternalId?: string | null;
  externalId?: string | null;
};

export type OwnerImportRow = {
  rowNumber: number;
  externalOwnerId: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
};

export type PatientImportRow = {
  rowNumber: number;
  externalPatientId: string;
  externalOwnerId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  birthDate: string | null;
  microchip: string | null;
  color: string | null;
  weightKg: number | null;
  status: string | null;
  notes: string | null;
};

export type ClinicalImportRow = {
  rowNumber: number;
  externalClinicalId: string;
  externalPatientId: string;
  originalDate: string;
  originalVeterinarian: string | null;
  recordType: string;
  reason: string | null;
  anamnesis: string | null;
  clinicalFindings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  observations: string | null;
  sourceSystem: string | null;
};

export function mapRow(
  raw: Record<string, string>,
  mapping: Record<string, string | null>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, source] of Object.entries(mapping)) {
    out[field] = source ? (raw[source] ?? '').trim() : '';
  }
  return out;
}

export function validateOwnerRows(
  rows: OwnerImportRow[],
  options?: {
    existingDocuments?: Set<string>;
    existingEmails?: Set<string>;
    documentToId?: Map<string, string>;
    emailToId?: Map<string, string>;
  }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenExternal = new Set<string>();
  for (const row of rows) {
    if (!row.externalOwnerId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'external_owner_id',
        code: 'required',
        message: 'Falta ID externo de propietario',
        severity: 'error',
        recommendedAction: 'Completar external_owner_id',
      });
    } else if (seenExternal.has(row.externalOwnerId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'external_owner_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
        sourceReference: row.externalOwnerId,
      });
    } else {
      seenExternal.add(row.externalOwnerId);
    }

    if (!row.fullName) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'full_name',
        code: 'required',
        message: 'Falta nombre completo',
        severity: 'error',
      });
    }
    if (row.email && !isValidEmail(row.email)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'email',
        code: 'invalid_email',
        message: 'Email inválido',
        severity: 'error',
        recommendedAction: 'Corregir formato de email',
      });
    }
    if (row.documentNumber && options?.existingDocuments?.has(normalizeDocument(row.documentNumber))) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'document_number',
        code: 'possible_duplicate',
        message: 'Posible duplicado por documento',
        severity: 'warning',
        recommendedAction: 'Elegir vincular o crear nuevo',
        sourceReference: row.documentNumber,
        matchInternalId: options.documentToId?.get(normalizeDocument(row.documentNumber)),
      });
    }
    if (row.email && options?.existingEmails?.has(row.email.toLowerCase())) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'owners',
        field: 'email',
        code: 'possible_duplicate',
        message: 'Posible duplicado por email',
        severity: 'warning',
        recommendedAction: 'Elegir vincular o crear nuevo',
        matchInternalId: options.emailToId?.get(row.email.toLowerCase()),
      });
    }
  }
  return issues;
}

export function validatePatientRows(
  rows: PatientImportRow[],
  options?: {
    knownOwnerExternalIds?: Set<string>;
    existingMicrochips?: Set<string>;
    microchipToId?: Map<string, string>;
    locale?: DateLocale;
  }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const locale = options?.locale ?? 'es-AR';
  for (const row of rows) {
    if (!row.externalPatientId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'external_patient_id',
        code: 'required',
        message: 'Falta ID externo de paciente',
        severity: 'error',
      });
    } else if (seen.has(row.externalPatientId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'external_patient_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalPatientId);
    }
    if (!row.externalOwnerId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'external_owner_id',
        code: 'required',
        message: 'Falta ID externo de propietario',
        severity: 'error',
      });
    } else if (
      options?.knownOwnerExternalIds &&
      !options.knownOwnerExternalIds.has(row.externalOwnerId)
    ) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'external_owner_id',
        code: 'missing_owner',
        message: 'No se encontró el propietario referenciado',
        severity: 'error',
        recommendedAction: 'Importar propietarios primero o corregir ID',
        sourceReference: row.externalOwnerId,
      });
    }
    if (!row.name) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'name',
        code: 'required',
        message: 'Falta nombre del paciente',
        severity: 'error',
      });
    }
    if (!row.species) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'species',
        code: 'required',
        message: 'Falta especie',
        severity: 'error',
      });
    }
    if (row.birthDate) {
      const parsed = parseImportDate(row.birthDate, locale);
      if (!parsed.ok) {
        issues.push({
          rowNumber: row.rowNumber,
          entityType: 'patients',
          field: 'birth_date',
          code: 'invalid_date',
          message: 'Fecha de nacimiento inválida',
          severity: 'error',
          recommendedAction: 'Usar YYYY-MM-DD o el locale elegido',
        });
      }
    }
    if (row.microchip && options?.existingMicrochips?.has(row.microchip)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'patients',
        field: 'microchip',
        code: 'possible_duplicate',
        message: 'Posible duplicado por microchip',
        severity: 'warning',
        recommendedAction: 'Vincular a paciente existente o revisar',
        matchInternalId: options.microchipToId?.get(row.microchip),
      });
    }
  }
  return issues;
}

export function validateClinicalRows(
  rows: ClinicalImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  for (const row of rows) {
    if (!row.externalClinicalId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'clinical_entries',
        field: 'external_clinical_record_id',
        code: 'required',
        message: 'Falta ID externo del registro clínico',
        severity: 'error',
      });
    }
    if (!row.externalPatientId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'clinical_entries',
        field: 'external_patient_id',
        code: 'required',
        message: 'Falta ID externo del paciente',
        severity: 'error',
      });
    } else if (
      options?.knownPatientExternalIds &&
      !options.knownPatientExternalIds.has(row.externalPatientId)
    ) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'clinical_entries',
        field: 'external_patient_id',
        code: 'missing_patient',
        message: 'No se encontró el paciente referenciado',
        severity: 'error',
        recommendedAction: 'Importar pacientes primero',
        sourceReference: row.externalPatientId,
      });
    }
    const parsed = parseImportDate(row.originalDate, locale);
    if (!parsed.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'clinical_entries',
        field: 'original_date',
        code: 'invalid_date',
        message: 'Fecha original inválida o ambigua',
        severity: 'error',
        recommendedAction: 'Confirmar locale o usar YYYY-MM-DD',
      });
    }
  }
  return issues;
}

export function buildOwnerTemplateCsv(): string {
  return toCsv(
    OWNER_IMPORT_FIELDS.map((f) => f.key),
    [
      {
        external_owner_id: 'OWN-001',
        full_name: 'Juan Perez',
        document_type: 'DNI',
        document_number: '30111222',
        phone: '1155555555',
        email: 'juan@email.com',
        address: 'Av. Cordoba 1234',
        city: 'Buenos Aires',
        province: 'CABA',
        postal_code: '1414',
        notes: 'Ejemplo',
      },
    ]
  );
}

export function buildPatientTemplateCsv(): string {
  return toCsv(
    PATIENT_IMPORT_FIELDS.map((f) => f.key),
    [
      {
        external_patient_id: 'PAT-001',
        external_owner_id: 'OWN-001',
        name: 'Rocky',
        species: 'Canino',
        breed: 'Labrador',
        sex: 'Macho',
        birth_date: '2020-03-12',
        microchip: '985141000123',
        color: 'Golden',
        weight_kg: '31.5',
        status: 'active',
        notes: '',
      },
    ]
  );
}

export function buildClinicalTemplateCsv(): string {
  return toCsv(
    CLINICAL_IMPORT_FIELDS.map((f) => f.key),
    [
      {
        external_clinical_record_id: 'CLI-001',
        external_patient_id: 'PAT-001',
        original_date: '2024-05-14',
        original_veterinarian: 'Dr. Juan Lopez',
        record_type: 'consulta',
        reason: 'Control anual',
        anamnesis: 'Sin novedades',
        clinical_findings: 'Buen estado general',
        diagnosis: 'Saludable',
        treatment: 'Ninguno',
        observations: 'Volver en 12 meses',
        source_system: 'VetLegacy',
      },
    ]
  );
}

export type VaccinationImportRow = {
  rowNumber: number;
  externalVaccinationId: string;
  externalPatientId: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt: string | null;
  manufacturer: string | null;
  lotNumber: string | null;
  originalVeterinarian: string | null;
  notes: string | null;
  sourceSystem: string | null;
};

export function validateVaccinationRows(
  rows: VaccinationImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalVaccinationId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'external_vaccination_id',
        code: 'required',
        message: 'Falta ID externo de vacunación',
        severity: 'error',
      });
    } else if (seen.has(row.externalVaccinationId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'external_vaccination_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalVaccinationId);
    }
    if (!row.externalPatientId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'external_patient_id',
        code: 'required',
        message: 'Falta ID externo del paciente',
        severity: 'error',
      });
    } else if (
      options?.knownPatientExternalIds &&
      !options.knownPatientExternalIds.has(row.externalPatientId)
    ) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'external_patient_id',
        code: 'missing_patient',
        message: 'No se encontró el paciente referenciado',
        severity: 'error',
        recommendedAction: 'Importar pacientes primero',
        sourceReference: row.externalPatientId,
      });
    }
    if (!row.vaccineName || row.vaccineName.trim().length < 2) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'vaccine_name',
        code: 'required',
        message: 'Falta nombre de vacuna',
        severity: 'error',
      });
    }
    const administered = parseImportDate(row.administeredAt, locale);
    if (!administered.ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'vaccinations',
        field: 'administered_at',
        code: 'invalid_date',
        message: 'Fecha de aplicación inválida',
        severity: 'error',
      });
    }
    if (row.nextDueAt) {
      const next = parseImportDate(row.nextDueAt, locale);
      if (!next.ok) {
        issues.push({
          rowNumber: row.rowNumber,
          entityType: 'vaccinations',
          field: 'next_due_at',
          code: 'invalid_date',
          message: 'Fecha de próxima dosis inválida',
          severity: 'error',
        });
      }
    }
  }
  return issues;
}

export function buildVaccinationTemplateCsv(): string {
  return toCsv(
    VACCINATION_IMPORT_FIELDS.map((f) => f.key),
    [
      {
        external_vaccination_id: 'VAC-001',
        external_patient_id: 'PAT-001',
        vaccine_name: 'Antirrábica',
        administered_at: '2024-03-01',
        next_due_at: '2025-03-01',
        manufacturer: 'ExampleLab',
        lot_number: 'L-123',
        original_veterinarian: 'Dra. Garcia',
        notes: '',
        source_system: 'VetLegacy',
      },
    ]
  );
}

export type MigrationZipManifest = {
  format: string;
  version: string;
  createdAt?: string;
  sourceSystem?: string;
  entities?: Record<string, number>;
};

export function parseMigrationManifest(raw: unknown): MigrationZipManifest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.format !== DATA_MIGRATION_FORMAT) return null;
  if (typeof obj.version !== 'string') return null;
  return {
    format: String(obj.format),
    version: String(obj.version),
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
    sourceSystem: typeof obj.sourceSystem === 'string' ? obj.sourceSystem : undefined,
    entities:
      obj.entities && typeof obj.entities === 'object' && !Array.isArray(obj.entities)
        ? Object.fromEntries(
            Object.entries(obj.entities as Record<string, unknown>).map(([k, v]) => [
              k,
              Number(v) || 0,
            ])
          )
        : undefined,
  };
}

export function buildSampleMigrationManifest(sourceSystem = 'VetLegacy'): MigrationZipManifest {
  return {
    format: DATA_MIGRATION_FORMAT,
    version: DATA_MIGRATION_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    sourceSystem,
    entities: {
      owners: 1,
      patients: 1,
      clinicalRecords: 1,
      vaccinations: 1,
      labOrders: 1,
      surgeries: 1,
      prescriptions: 1,
      hospitalizations: 1,
    },
  };
}

export type LabOrderImportRow = {
  rowNumber: number;
  externalLabOrderId: string;
  externalPatientId: string;
  orderedAt: string;
  title: string;
  tests: string | null;
  priority: string | null;
  sampleType: string | null;
  interpretation: string | null;
  originalVeterinarian: string | null;
  notes: string | null;
  sourceSystem: string | null;
};

export type SurgeryImportRow = {
  rowNumber: number;
  externalSurgeryId: string;
  externalPatientId: string;
  scheduledAt: string;
  procedureName: string;
  diagnosis: string | null;
  anesthesia: string | null;
  asa: string | null;
  originalVeterinarian: string | null;
  notes: string | null;
  sourceSystem: string | null;
};

export type PrescriptionImportRow = {
  rowNumber: number;
  externalPrescriptionId: string;
  externalPatientId: string;
  prescribedAt: string;
  medicationName: string;
  dose: string;
  frequency: string;
  duration: string | null;
  route: string | null;
  quantity: string | null;
  instructions: string | null;
  originalVeterinarian: string | null;
  notes: string | null;
  sourceSystem: string | null;
};

function pushMissingPatient(
  issues: ValidationIssue[],
  rowNumber: number,
  entityType: string,
  externalPatientId: string,
  known?: Set<string>
) {
  if (!externalPatientId) {
    issues.push({
      rowNumber,
      entityType,
      field: 'external_patient_id',
      code: 'required',
      message: 'Falta ID externo del paciente',
      severity: 'error',
    });
    return;
  }
  if (known && !known.has(externalPatientId)) {
    issues.push({
      rowNumber,
      entityType,
      field: 'external_patient_id',
      code: 'missing_patient',
      message: 'No se encontró el paciente referenciado',
      severity: 'error',
      recommendedAction: 'Importar pacientes primero',
      sourceReference: externalPatientId,
    });
  }
}

export function validateLabOrderRows(
  rows: LabOrderImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalLabOrderId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'lab_orders',
        field: 'external_lab_order_id',
        code: 'required',
        message: 'Falta ID externo de laboratorio',
        severity: 'error',
      });
    } else if (seen.has(row.externalLabOrderId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'lab_orders',
        field: 'external_lab_order_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalLabOrderId);
    }
    pushMissingPatient(
      issues,
      row.rowNumber,
      'lab_orders',
      row.externalPatientId,
      options?.knownPatientExternalIds
    );
    if (!row.title || row.title.trim().length < 2) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'lab_orders',
        field: 'title',
        code: 'required',
        message: 'Falta título del estudio',
        severity: 'error',
      });
    }
    if (!parseImportDate(row.orderedAt, locale).ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'lab_orders',
        field: 'ordered_at',
        code: 'invalid_date',
        message: 'Fecha de solicitud inválida',
        severity: 'error',
      });
    }
  }
  return issues;
}

export function validateSurgeryRows(
  rows: SurgeryImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalSurgeryId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'surgeries',
        field: 'external_surgery_id',
        code: 'required',
        message: 'Falta ID externo de cirugía',
        severity: 'error',
      });
    } else if (seen.has(row.externalSurgeryId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'surgeries',
        field: 'external_surgery_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalSurgeryId);
    }
    pushMissingPatient(
      issues,
      row.rowNumber,
      'surgeries',
      row.externalPatientId,
      options?.knownPatientExternalIds
    );
    if (!row.procedureName || row.procedureName.trim().length < 2) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'surgeries',
        field: 'procedure_name',
        code: 'required',
        message: 'Falta nombre del procedimiento',
        severity: 'error',
      });
    }
    if (!parseImportDate(row.scheduledAt, locale).ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'surgeries',
        field: 'scheduled_at',
        code: 'invalid_date',
        message: 'Fecha de cirugía inválida',
        severity: 'error',
      });
    }
  }
  return issues;
}

export function validatePrescriptionRows(
  rows: PrescriptionImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalPrescriptionId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'external_prescription_id',
        code: 'required',
        message: 'Falta ID externo de receta',
        severity: 'error',
      });
    } else if (seen.has(row.externalPrescriptionId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'external_prescription_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalPrescriptionId);
    }
    pushMissingPatient(
      issues,
      row.rowNumber,
      'prescriptions',
      row.externalPatientId,
      options?.knownPatientExternalIds
    );
    if (!row.medicationName) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'medication_name',
        code: 'required',
        message: 'Falta medicamento',
        severity: 'error',
      });
    }
    if (!row.dose) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'dose',
        code: 'required',
        message: 'Falta dosis',
        severity: 'error',
      });
    }
    if (!row.frequency) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'frequency',
        code: 'required',
        message: 'Falta frecuencia',
        severity: 'error',
      });
    }
    if (!parseImportDate(row.prescribedAt, locale).ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'prescriptions',
        field: 'prescribed_at',
        code: 'invalid_date',
        message: 'Fecha de receta inválida',
        severity: 'error',
      });
    }
  }
  return issues;
}

export function buildLabOrderTemplateCsv(): string {
  return toCsv(LAB_ORDER_IMPORT_FIELDS.map((f) => f.key), [
    {
      external_lab_order_id: 'LAB-001',
      external_patient_id: 'PAT-001',
      ordered_at: '2024-06-01',
      title: 'Hemograma',
      tests: 'Hemograma|Glucemia',
      priority: 'rutina',
      sample_type: 'sangre',
      interpretation: 'Dentro de parámetros',
      original_veterinarian: 'Dr. Lopez',
      notes: '',
      source_system: 'VetLegacy',
    },
  ]);
}

export function buildSurgeryTemplateCsv(): string {
  return toCsv(SURGERY_IMPORT_FIELDS.map((f) => f.key), [
    {
      external_surgery_id: 'SUR-001',
      external_patient_id: 'PAT-001',
      scheduled_at: '2024-07-10',
      procedure_name: 'Ovariohisterectomía',
      diagnosis: 'Electiva',
      anesthesia: 'general',
      asa: 'I',
      original_veterinarian: 'Dra. Garcia',
      notes: 'Sin complicaciones',
      source_system: 'VetLegacy',
    },
  ]);
}

export function buildPrescriptionTemplateCsv(): string {
  return toCsv(PRESCRIPTION_IMPORT_FIELDS.map((f) => f.key), [
    {
      external_prescription_id: 'RX-001',
      external_patient_id: 'PAT-001',
      prescribed_at: '2024-08-01',
      medication_name: 'Amoxicilina',
      dose: '250 mg',
      frequency: 'cada 12 h',
      duration: '7 días',
      route: 'oral',
      quantity: '14',
      instructions: 'Con comida',
      original_veterinarian: 'Dr. Lopez',
      notes: '',
      source_system: 'VetLegacy',
    },
  ]);
}

export function chunkRange(total: number, offset: number, chunkSize = DEFAULT_IMPORT_CHUNK_SIZE) {
  const safeOffset = Math.max(0, offset);
  const safeChunk = Math.min(500, Math.max(1, chunkSize));
  const end = Math.min(total, safeOffset + safeChunk);
  return {
    offset: safeOffset,
    end,
    size: Math.max(0, end - safeOffset),
    done: end >= total,
    nextOffset: end,
    total,
  };
}

export type MigrationAttachmentRef = {
  zipPath: string;
  externalPatientId: string;
  filename: string;
};

/** attachments/<externalPatientId>/<filename> */
export function parseMigrationAttachmentPath(zipPath: string): MigrationAttachmentRef | null {
  const normalized = zipPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const marker = 'attachments/';
  const idx = normalized.indexOf(marker);
  if (idx < 0) return null;
  const rest = normalized.slice(idx + marker.length);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const externalPatientId = parts[0]!;
  const filename = parts.slice(1).join('/');
  if (!externalPatientId || !filename || filename.toLowerCase() === 'readme.txt') return null;
  return { zipPath: normalized, externalPatientId, filename };
}

export function guessMimeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return null;
}

export type HospitalizationImportRow = {
  rowNumber: number;
  externalHospitalizationId: string;
  externalPatientId: string;
  admittedAt: string;
  dischargedAt: string | null;
  reason: string;
  diagnosis: string | null;
  treatmentPlan: string | null;
  cage: string | null;
  status: string | null;
  originalVeterinarian: string | null;
  notes: string | null;
  sourceSystem: string | null;
};

export function validateHospitalizationRows(
  rows: HospitalizationImportRow[],
  options?: { knownPatientExternalIds?: Set<string>; locale?: DateLocale }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const locale = options?.locale ?? 'es-AR';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalHospitalizationId) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'hospitalizations',
        field: 'external_hospitalization_id',
        code: 'required',
        message: 'Falta ID externo de internación',
        severity: 'error',
      });
    } else if (seen.has(row.externalHospitalizationId)) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'hospitalizations',
        field: 'external_hospitalization_id',
        code: 'duplicate_in_file',
        message: 'ID externo duplicado en el archivo',
        severity: 'error',
      });
    } else {
      seen.add(row.externalHospitalizationId);
    }
    pushMissingPatient(
      issues,
      row.rowNumber,
      'hospitalizations',
      row.externalPatientId,
      options?.knownPatientExternalIds
    );
    if (!row.reason || row.reason.trim().length < 2) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'hospitalizations',
        field: 'reason',
        code: 'required',
        message: 'Falta motivo de internación',
        severity: 'error',
      });
    }
    if (!parseImportDate(row.admittedAt, locale).ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'hospitalizations',
        field: 'admitted_at',
        code: 'invalid_date',
        message: 'Fecha de ingreso inválida',
        severity: 'error',
      });
    }
    if (row.dischargedAt && !parseImportDate(row.dischargedAt, locale).ok) {
      issues.push({
        rowNumber: row.rowNumber,
        entityType: 'hospitalizations',
        field: 'discharged_at',
        code: 'invalid_date',
        message: 'Fecha de alta inválida',
        severity: 'error',
      });
    }
  }
  return issues;
}

export function buildHospitalizationTemplateCsv(): string {
  return toCsv(HOSPITALIZATION_IMPORT_FIELDS.map((f) => f.key), [
    {
      external_hospitalization_id: 'HOSP-001',
      external_patient_id: 'PAT-001',
      admitted_at: '2024-09-01',
      discharged_at: '2024-09-05',
      reason: 'Gastroenteritis',
      diagnosis: 'GEA',
      treatment_plan: 'Fluidoterapia',
      cage: 'B2',
      status: 'alta',
      original_veterinarian: 'Dra. Garcia',
      notes: '',
      source_system: 'VetLegacy',
    },
  ]);
}

/** Default unresolved duplicate warnings to review (never silent create/link). */
export function defaultDecisionForIssue(issue: ValidationIssue): ConflictPolicy {
  if (issue.code !== 'possible_duplicate') return 'create';
  return 'review';
}

export function unresolvedConflictRows(
  issues: ValidationIssue[],
  decisions: Record<number, RowConflictDecision>
): number[] {
  const rows = new Set<number>();
  for (const issue of issues) {
    if (issue.code !== 'possible_duplicate') continue;
    const decision = decisions[issue.rowNumber]?.decision ?? 'review';
    if (decision === 'review') rows.add(issue.rowNumber);
    if (decision === 'link' && !decisions[issue.rowNumber]?.linkInternalId && !issue.matchInternalId) {
      rows.add(issue.rowNumber);
    }
  }
  return [...rows].sort((a, b) => a - b);
}

export function summarizeIssues(issues: ValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return { errors, warnings };
}

export function buildValidationReportCsv(issues: ValidationIssue[]): string {
  return toCsv(
    [
      'row_number',
      'entity_type',
      'field',
      'code',
      'severity',
      'message',
      'recommended_action',
      'source_reference',
      'match_internal_id',
    ],
    issues.map((issue) => ({
      row_number: issue.rowNumber,
      entity_type: issue.entityType,
      field: issue.field ?? '',
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      recommended_action: issue.recommendedAction ?? '',
      source_reference: issue.sourceReference ?? '',
      match_internal_id: issue.matchInternalId ?? '',
    }))
  );
}

export function buildBatchErrorsReportCsv(
  rows: Array<{
    rowNumber?: number | null;
    entityType?: string | null;
    errorCode?: string | null;
    errorMessage: string;
    fieldName?: string | null;
    sourceReference?: string | null;
    severity?: string | null;
    recommendedAction?: string | null;
  }>
): string {
  return toCsv(
    [
      'row_number',
      'entity_type',
      'error_code',
      'severity',
      'error_message',
      'field_name',
      'source_reference',
      'recommended_action',
    ],
    rows.map((row) => ({
      row_number: row.rowNumber ?? '',
      entity_type: row.entityType ?? '',
      error_code: row.errorCode ?? '',
      severity: row.severity ?? '',
      error_message: row.errorMessage,
      field_name: row.fieldName ?? '',
      source_reference: row.sourceReference ?? '',
      recommended_action: row.recommendedAction ?? '',
    }))
  );
}
