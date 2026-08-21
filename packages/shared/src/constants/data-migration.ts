/** SyncVete data import/export — pure helpers (no DB I/O). */

export const DATA_MIGRATION_FORMAT_VERSION = '1.0';
export const DATA_MIGRATION_FORMAT = 'syncvete-migration';

export const IMPORT_TYPES = [
  'owners',
  'patients',
  'clinical_entries',
  'vaccinations',
  'full_migration',
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  owners: 'Propietarios',
  patients: 'Pacientes',
  clinical_entries: 'Historias clínicas',
  vaccinations: 'Vacunaciones',
  full_migration: 'Migración completa',
};

export const EXPORT_TYPES = [
  'owners',
  'patients',
  'clinical_entries',
  'patient_clinical',
  'full_clinic',
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  owners: 'Propietarios',
  patients: 'Pacientes',
  clinical_entries: 'Historias clínicas',
  patient_clinical: 'Historia de un paciente',
  full_clinic: 'Exportación completa de la clínica',
};

export const EXPORT_FORMATS = ['csv', 'json', 'xlsx', 'pdf', 'zip'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const DATE_LOCALES = ['es-AR', 'en-US', 'iso'] as const;
export type DateLocale = (typeof DATE_LOCALES)[number];

export const CONFLICT_POLICIES = ['create', 'link', 'skip', 'review'] as const;
export type ConflictPolicy = (typeof CONFLICT_POLICIES)[number];

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
  options?: { existingDocuments?: Set<string>; existingEmails?: Set<string> }
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

export function summarizeIssues(issues: ValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return { errors, warnings };
}
