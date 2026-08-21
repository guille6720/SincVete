import { describe, expect, it } from 'vitest';
import {
  autoMapColumns,
  buildOwnerTemplateCsv,
  normalizeDocument,
  OWNER_IMPORT_FIELDS,
  parseCsv,
  parseImportDate,
  validateClinicalRows,
  validateOwnerRows,
  validatePatientRows,
} from '../constants/data-migration';

describe('data-migration parseCsv', () => {
  it('parses quoted CSV with accents', () => {
    const csv = 'nombre,email\n"Juan Pérez",juan@email.com\n';
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(['nombre', 'email']);
    expect(parsed.rows[0]?.nombre).toBe('Juan Pérez');
  });
});

describe('data-migration autoMapColumns', () => {
  it('maps spanish aliases', () => {
    const mapping = autoMapColumns(
      ['Nombre', 'DNI', 'Correo', 'Celular', 'ID'],
      OWNER_IMPORT_FIELDS
    );
    expect(mapping.full_name).toBe('Nombre');
    expect(mapping.document_number).toBe('DNI');
    expect(mapping.email).toBe('Correo');
    expect(mapping.phone).toBe('Celular');
  });
});

describe('data-migration parseImportDate', () => {
  it('parses ISO dates', () => {
    expect(parseImportDate('2024-05-14', 'es-AR')).toEqual({
      ok: true,
      isoDate: '2024-05-14',
    });
  });

  it('parses DD/MM/YYYY for es-AR', () => {
    expect(parseImportDate('14/05/2024', 'es-AR')).toEqual({
      ok: true,
      isoDate: '2024-05-14',
    });
  });

  it('parses MM/DD/YYYY for en-US', () => {
    expect(parseImportDate('05/14/2024', 'en-US')).toEqual({
      ok: true,
      isoDate: '2024-05-14',
    });
  });

  it('rejects empty', () => {
    expect(parseImportDate('  ', 'es-AR').ok).toBe(false);
  });
});

describe('data-migration owner validation', () => {
  it('accepts valid owner', () => {
    const issues = validateOwnerRows([
      {
        rowNumber: 2,
        externalOwnerId: 'OWN-001',
        fullName: 'Juan Perez',
        documentType: 'DNI',
        documentNumber: '30111222',
        phone: '1155555555',
        email: 'juan@email.com',
        address: null,
        city: null,
        province: null,
        postalCode: null,
        notes: null,
      },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('flags missing required and invalid email', () => {
    const issues = validateOwnerRows([
      {
        rowNumber: 2,
        externalOwnerId: '',
        fullName: '',
        documentType: null,
        documentNumber: null,
        phone: null,
        email: 'bad',
        address: null,
        city: null,
        province: null,
        postalCode: null,
        notes: null,
      },
    ]);
    expect(issues.some((i) => i.code === 'required')).toBe(true);
    expect(issues.some((i) => i.code === 'invalid_email')).toBe(true);
  });

  it('warns on existing document', () => {
    const issues = validateOwnerRows(
      [
        {
          rowNumber: 2,
          externalOwnerId: 'OWN-001',
          fullName: 'Juan Perez',
          documentType: 'DNI',
          documentNumber: '30.111.222',
          phone: null,
          email: null,
          address: null,
          city: null,
          province: null,
          postalCode: null,
          notes: null,
        },
      ],
      { existingDocuments: new Set([normalizeDocument('30111222')]) }
    );
    expect(issues.some((i) => i.code === 'possible_duplicate')).toBe(true);
  });
});

describe('data-migration patient validation', () => {
  it('requires owner reference', () => {
    const issues = validatePatientRows(
      [
        {
          rowNumber: 2,
          externalPatientId: 'PAT-001',
          externalOwnerId: 'OWN-MISSING',
          name: 'Rocky',
          species: 'Canino',
          breed: null,
          sex: 'Macho',
          birthDate: '2020-03-12',
          microchip: null,
          color: null,
          weightKg: null,
          status: 'active',
          notes: null,
        },
      ],
      { knownOwnerExternalIds: new Set(['OWN-001']) }
    );
    expect(issues.some((i) => i.code === 'missing_owner')).toBe(true);
  });

  it('warns duplicate microchip', () => {
    const issues = validatePatientRows(
      [
        {
          rowNumber: 2,
          externalPatientId: 'PAT-001',
          externalOwnerId: 'OWN-001',
          name: 'Rocky',
          species: 'Canino',
          breed: null,
          sex: 'Macho',
          birthDate: null,
          microchip: '985141000123',
          color: null,
          weightKg: null,
          status: null,
          notes: null,
        },
      ],
      {
        knownOwnerExternalIds: new Set(['OWN-001']),
        existingMicrochips: new Set(['985141000123']),
      }
    );
    expect(issues.some((i) => i.code === 'possible_duplicate')).toBe(true);
  });
});

describe('data-migration clinical validation', () => {
  it('keeps original date required and patient link', () => {
    const issues = validateClinicalRows(
      [
        {
          rowNumber: 2,
          externalClinicalId: 'CLI-001',
          externalPatientId: 'PAT-X',
          originalDate: '03/04/2024',
          originalVeterinarian: 'Dr. Lopez',
          recordType: 'consulta',
          reason: null,
          anamnesis: null,
          clinicalFindings: null,
          diagnosis: null,
          treatment: null,
          observations: null,
          sourceSystem: 'VetLegacy',
        },
      ],
      { knownPatientExternalIds: new Set(['PAT-001']), locale: 'es-AR' }
    );
    expect(issues.some((i) => i.code === 'missing_patient')).toBe(true);
    expect(issues.some((i) => i.severity === 'error' && i.field === 'original_date')).toBe(false);
  });
});

describe('data-migration templates', () => {
  it('builds owner template with example row', () => {
    const csv = buildOwnerTemplateCsv();
    expect(csv).toContain('external_owner_id');
    expect(csv).toContain('OWN-001');
  });
});
