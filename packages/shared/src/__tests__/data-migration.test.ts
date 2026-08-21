import { describe, expect, it } from 'vitest';
import {
  autoMapColumns,
  buildBranchTemplateCsv,
  buildOwnerTemplateCsv,
  buildPatientTemplateCsv,
  buildVaccinationTemplateCsv,
  CLINICAL_IMPORT_FIELDS,
  chunkRange,
  guessMimeFromFilename,
  normalizeDocument,
  OWNER_IMPORT_FIELDS,
  PATIENT_IMPORT_FIELDS,
  parseCsv,
  parseImportDate,
  parseMigrationAttachmentPath,
  parseMigrationManifest,
  normalizeExportDateRange,
  isSpecialtyExportType,
  nextFullMigrationStep,
  previousFullMigrationStep,
  FULL_MIGRATION_STEPS,
  buildValidationReportCsv,
  buildBatchErrorsReportCsv,
  unresolvedConflictRows,
  EXPORT_TYPE_LABELS,
  EXPORT_TYPES,
  IMPORT_TYPES,
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_ZIP_BYTES,
  buildIntegrityReportCsv,
  buildIdMapReportCsv,
  sumOrphanCounts,
  parseImportDateTime,
  validateAppointmentRows,
  validateConsultationRows,
  buildAppointmentTemplateCsv,
  buildConsultationTemplateCsv,
  buildInventoryProductTemplateCsv,
  validateInventoryProductRows,
  buildInvoiceTemplateCsv,
  validateInvoiceRows,
  buildPaymentTemplateCsv,
  validatePaymentRows,
  buildBillingReconcileCsv,
  buildCutoverPackReadme,
  buildMigrationChecklistCsv,
  DATA_MIGRATION_AUDIT_ACTIONS,
  isCutoverPackReady,
  summarizeMigrationChecklist,
  validateBranchRows,
  validateClinicalRows,
  validateLabOrderRows,
  validateOwnerRows,
  validatePatientRows,
  validateVaccinationRows,
  resolveImportBranchId,
  DATA_MIGRATION_FORMAT_VERSION,
  buildSampleMigrationManifest,
} from '../constants/data-migration';

describe('data-migration branch-aware imports (phase 23)', () => {
  it('resolveImportBranchId uses default, mapped id, or fails unmapped', () => {
    expect(
      resolveImportBranchId({
        externalBranchId: null,
        branchIdByExternal: { 'BR-001': 'uuid-1' },
        defaultBranchId: 'default-branch',
      })
    ).toEqual({ ok: true, branchId: 'default-branch' });

    expect(
      resolveImportBranchId({
        externalBranchId: 'BR-001',
        branchIdByExternal: { 'BR-001': 'uuid-1' },
        defaultBranchId: 'default-branch',
      })
    ).toEqual({ ok: true, branchId: 'uuid-1' });

    expect(
      resolveImportBranchId({
        externalBranchId: 'BR-404',
        branchIdByExternal: { 'BR-001': 'uuid-1' },
        defaultBranchId: 'default-branch',
      })
    ).toEqual({ ok: false, reason: 'unmapped_branch' });
  });

  it('validateAppointmentRows flags unmapped external_branch_id and accepts mapped', () => {
    const baseRow = {
      externalAppointmentId: 'A1',
      externalPatientId: 'P1',
      startsAt: '2024-10-01 10:00',
      endsAt: '2024-10-01 10:30',
      appointmentType: 'consulta',
      status: 'programada',
      title: 'Control',
      notes: null,
      sourceSystem: 'legacy',
    };
    const unmapped = validateAppointmentRows(
      [{ rowNumber: 2, ...baseRow, externalBranchId: 'BR-404' }],
      { knownPatientExternalIds: new Set(['P1']), knownBranchExternalIds: new Set(['BR-001']), locale: 'es-AR' }
    );
    expect(unmapped.some((i) => i.code === 'unmapped_branch')).toBe(true);

    const mapped = validateAppointmentRows(
      [{ rowNumber: 2, ...baseRow, externalBranchId: 'BR-001' }],
      { knownPatientExternalIds: new Set(['P1']), knownBranchExternalIds: new Set(['BR-001']), locale: 'es-AR' }
    );
    expect(mapped.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('uses migration format version 1.3', () => {
    expect(DATA_MIGRATION_FORMAT_VERSION).toBe('1.3');
    expect(buildSampleMigrationManifest().version).toBe('1.3');
  });
});

describe('data-migration branch-aware owners/patients (phase 30)', () => {
  it('OWNER_IMPORT_FIELDS and PATIENT_IMPORT_FIELDS include external_branch_id', () => {
    expect(OWNER_IMPORT_FIELDS.some((f) => f.key === 'external_branch_id')).toBe(true);
    expect(PATIENT_IMPORT_FIELDS.some((f) => f.key === 'external_branch_id')).toBe(true);
  });

  it('validateOwnerRows flags unmapped external_branch_id', () => {
    const issues = validateOwnerRows(
      [
        {
          rowNumber: 2,
          externalOwnerId: 'OWN-001',
          externalBranchId: 'BR-404',
          fullName: 'Juan Perez',
          documentType: null,
          documentNumber: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          province: null,
          postalCode: null,
          notes: null,
        },
      ],
      { knownBranchExternalIds: new Set(['BR-001']) }
    );
    expect(issues.some((i) => i.code === 'unmapped_branch')).toBe(true);
  });

  it('buildOwnerTemplateCsv and buildPatientTemplateCsv include external_branch_id sample', () => {
    expect(buildOwnerTemplateCsv()).toContain('external_branch_id');
    expect(buildOwnerTemplateCsv()).toContain('BR-001');
    expect(buildPatientTemplateCsv()).toContain('external_branch_id');
    expect(buildPatientTemplateCsv()).toContain('BR-001');
  });
});

describe('data-migration branch-aware clinical imports (phase 25)', () => {
  it('CLINICAL_IMPORT_FIELDS includes external_branch_id', () => {
    expect(CLINICAL_IMPORT_FIELDS.some((f) => f.key === 'external_branch_id')).toBe(true);
  });

  it('validateVaccinationRows flags unmapped external_branch_id', () => {
    const issues = validateVaccinationRows(
      [
        {
          rowNumber: 2,
          externalVaccinationId: 'VAC-001',
          externalPatientId: 'PAT-001',
          externalBranchId: 'BR-404',
          vaccineName: 'Antirrábica',
          administeredAt: '2024-03-01',
          nextDueAt: null,
          manufacturer: null,
          lotNumber: null,
          originalVeterinarian: null,
          notes: null,
          sourceSystem: 'VetLegacy',
        },
      ],
      {
        knownPatientExternalIds: new Set(['PAT-001']),
        knownBranchExternalIds: new Set(['BR-001']),
        locale: 'es-AR',
      }
    );
    expect(issues.some((i) => i.code === 'unmapped_branch')).toBe(true);
  });

  it('buildVaccinationTemplateCsv includes external_branch_id sample', () => {
    const csv = buildVaccinationTemplateCsv();
    expect(csv).toContain('external_branch_id');
    expect(csv).toContain('BR-001');
  });
});

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
        externalBranchId: null,
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
        externalBranchId: null,
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
          externalBranchId: null,
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
          externalBranchId: null,
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
          externalBranchId: null,
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
          externalBranchId: null,
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

  it('builds vaccination template', () => {
    const csv = buildVaccinationTemplateCsv();
    expect(csv).toContain('external_vaccination_id');
    expect(csv).toContain('VAC-001');
  });
});

describe('data-migration vaccination validation', () => {
  it('flags missing patient and invalid dates', () => {
    const issues = validateVaccinationRows(
      [
        {
          rowNumber: 2,
          externalVaccinationId: 'VAC-001',
          externalPatientId: 'PAT-404',
          externalBranchId: null,
          vaccineName: 'Antirrábica',
          administeredAt: 'no-date',
          nextDueAt: null,
          manufacturer: null,
          lotNumber: null,
          originalVeterinarian: null,
          notes: null,
          sourceSystem: 'VetLegacy',
        },
      ],
      { knownPatientExternalIds: new Set(['PAT-001']), locale: 'iso' }
    );
    expect(issues.some((i) => i.code === 'missing_patient')).toBe(true);
    expect(issues.some((i) => i.code === 'invalid_date')).toBe(true);
  });
});

describe('data-migration zip manifest', () => {
  it('accepts syncvete migration manifest', () => {
    const parsed = parseMigrationManifest({
      format: 'syncvete-migration',
      version: '1.0',
      sourceSystem: 'VetLegacy',
      entities: { owners: 1 },
    });
    expect(parsed?.format).toBe('syncvete-migration');
    expect(parsed?.entities?.owners).toBe(1);
  });

  it('rejects foreign manifests', () => {
    expect(parseMigrationManifest({ format: 'other', version: '1' })).toBeNull();
  });
});

describe('data-migration specialty + chunks', () => {
  it('validates lab order patient link', () => {
    const issues = validateLabOrderRows(
      [
        {
          rowNumber: 2,
          externalLabOrderId: 'LAB-1',
          externalPatientId: 'PAT-X',
          externalBranchId: 'BR-404',
          orderedAt: '2024-01-01',
          title: 'Hemograma',
          tests: 'Hemograma',
          priority: 'rutina',
          sampleType: 'sangre',
          interpretation: null,
          originalVeterinarian: null,
          notes: null,
          sourceSystem: null,
        },
      ],
      {
        knownPatientExternalIds: new Set(['PAT-001']),
        knownBranchExternalIds: new Set(['BR-001']),
        locale: 'iso',
      }
    );
    expect(issues.some((i) => i.code === 'missing_patient')).toBe(true);
    expect(issues.some((i) => i.code === 'unmapped_branch')).toBe(true);
  });

  it('parses attachment paths and chunks ranges', () => {
    const ref = parseMigrationAttachmentPath('attachments/PAT-001/rx.pdf');
    expect(ref?.externalPatientId).toBe('PAT-001');
    expect(ref?.filename).toBe('rx.pdf');
    expect(guessMimeFromFilename('rx.pdf')).toBe('application/pdf');
    expect(chunkRange(120, 50, 50)).toEqual({
      offset: 50,
      end: 100,
      size: 50,
      done: false,
      nextOffset: 100,
      total: 120,
    });
  });

  it('blocks unresolved conflict decisions', () => {
    const issues = [
      {
        rowNumber: 2,
        entityType: 'owners',
        code: 'possible_duplicate',
        message: 'dup',
        severity: 'warning' as const,
        matchInternalId: 'uuid-1',
      },
    ];
    expect(unresolvedConflictRows(issues, {})).toEqual([2]);
    expect(
      unresolvedConflictRows(issues, {
        2: { rowNumber: 2, decision: 'link', linkInternalId: 'uuid-1' },
      })
    ).toEqual([]);
  });

  it('normalizes export date ranges', () => {
    expect(normalizeExportDateRange({ dateFrom: '2024-05-01', dateTo: '2024-01-01' })).toEqual({
      dateFrom: '2024-01-01',
      dateTo: '2024-05-01',
    });
    expect(isSpecialtyExportType('lab_orders')).toBe(true);
    expect(isSpecialtyExportType('owners')).toBe(false);
  });

  it('orders full migration guide steps', () => {
    expect(nextFullMigrationStep('branches')).toBe('owners');
    expect(nextFullMigrationStep('owners')).toBe('patients');
    expect(nextFullMigrationStep('attachments')).toBeNull();
    expect(previousFullMigrationStep('owners')).toBe('branches');
    expect(previousFullMigrationStep('patients')).toBe('owners');
    expect(FULL_MIGRATION_STEPS).toHaveLength(15);
    expect(FULL_MIGRATION_STEPS).toContain('branches');
    expect(FULL_MIGRATION_STEPS).toContain('appointments');
    expect(FULL_MIGRATION_STEPS).toContain('consultations');
    expect(FULL_MIGRATION_STEPS).toContain('inventory_products');
    expect(FULL_MIGRATION_STEPS).toContain('invoices');
    expect(FULL_MIGRATION_STEPS).toContain('payments');
  });

  it('builds validation report csv', () => {
    const csv = buildValidationReportCsv([
      {
        rowNumber: 2,
        entityType: 'owners',
        code: 'possible_duplicate',
        message: 'dup',
        severity: 'warning',
        field: 'email',
        matchInternalId: 'abc',
      },
    ]);
    expect(csv).toContain('row_number');
    expect(csv).toContain('possible_duplicate');
    expect(csv).toContain('abc');
  });

  it('builds batch errors report csv', () => {
    const csv = buildBatchErrorsReportCsv([
      {
        rowNumber: 3,
        entityType: 'patients',
        errorCode: 'invalid_date',
        errorMessage: 'fecha inválida',
        severity: 'error',
      },
    ]);
    expect(csv).toContain('error_code');
    expect(csv).toContain('invalid_date');
  });

  it('labels specialty exports with items', () => {
    expect(EXPORT_TYPE_LABELS.branches).toMatch(/sucursal/i);
    expect(EXPORT_TYPE_LABELS.prescriptions).toMatch(/ítems/i);
    expect(EXPORT_TYPE_LABELS.lab_orders).toMatch(/ítems/i);
  });

  it('validates branch rows and template csv', () => {
    const issues = validateBranchRows([
      {
        rowNumber: 2,
        externalBranchId: 'BR-001',
        name: 'Sede Centro',
        code: 'CENTRO',
        address: null,
        phone: null,
        email: null,
        timezone: null,
        isActive: 'true',
        sourceSystem: 'legacy',
      },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(buildBranchTemplateCsv()).toContain('external_branch_id');
  });

  it('parses appointment datetimes and validates rows', () => {
    expect(parseImportDateTime('2024-10-01 10:00', 'es-AR').ok).toBe(true);
    expect(parseImportDateTime('01/10/2024 10:30', 'es-AR').ok).toBe(true);
    const issues = validateAppointmentRows(
      [
        {
          rowNumber: 2,
          externalAppointmentId: 'A1',
          externalPatientId: 'P1',
          startsAt: '2024-10-01 10:00',
          endsAt: '2024-10-01 10:30',
          appointmentType: 'consulta',
          status: 'programada',
          title: 'Control',
          notes: null,
          sourceSystem: 'legacy',
        },
      ],
      { knownPatientExternalIds: new Set(['P1']), locale: 'es-AR' }
    );
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    const template = buildAppointmentTemplateCsv();
    expect(template).toContain('external_appointment_id');
    expect(template).toContain('external_branch_id');
    expect(template).toContain('BR-001');
  });

  it('validates inventory product rows', () => {
    const issues = validateInventoryProductRows([
      {
        rowNumber: 2,
        externalProductId: 'P1',
        name: 'Amox',
        sku: 'A1',
        category: 'medicamento',
        unit: 'caja',
        quantity: '10',
        minQuantity: '1',
        unitCost: '100',
        unitPrice: '200',
        manufacturer: null,
        notes: null,
        sourceSystem: 'legacy',
      },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(buildInventoryProductTemplateCsv()).toContain('external_product_id');
  });

  it('validates invoice rows', () => {
    const issues = validateInvoiceRows([
      {
        rowNumber: 2,
        externalInvoiceId: 'INV-1',
        externalOwnerId: 'OWN-1',
        externalPatientId: 'PAT-1',
        number: 'A-1',
        status: 'emitida',
        issuedAt: '2024-01-01',
        currency: 'ARS',
        subtotal: '100',
        taxAmount: '0',
        total: '100',
        paidAmount: '0',
        balance: '100',
        description: 'Consulta',
        quantity: '1',
        unitPrice: '100',
        lineTotal: '100',
        externalProductId: null,
        notes: null,
        sourceSystem: 'legacy',
      },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(buildInvoiceTemplateCsv()).toContain('external_invoice_id');
  });

  it('validates payment rows', () => {
    const issues = validatePaymentRows([
      {
        rowNumber: 2,
        externalPaymentId: 'PAY-1',
        externalInvoiceId: 'INV-1',
        amount: '100',
        method: 'transferencia',
        paidAt: '2024-01-02',
        reference: 'TRX',
        notes: null,
        sourceSystem: 'legacy',
      },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(buildPaymentTemplateCsv()).toContain('external_payment_id');
  });

  it('warns when payment sum mismatches invoice paid_amount', () => {
    const issues = validatePaymentRows(
      [
        {
          rowNumber: 2,
          externalPaymentId: 'PAY-1',
          externalInvoiceId: 'INV-1',
          amount: '50',
          method: 'efectivo',
          paidAt: null,
          reference: null,
          notes: null,
          sourceSystem: 'legacy',
        },
      ],
      { invoicePaidAmountByExternal: new Map([['INV-1', 100]]) }
    );
    expect(issues.some((i) => i.code === 'paid_amount_mismatch')).toBe(true);
  });

  it('builds billing reconcile csv', () => {
    const csv = buildBillingReconcileCsv(
      [{ invoiceId: 'i1', invoiceNumber: 'A-1', paidAmount: 100, paymentsSum: 80, delta: 20 }],
      { organizationId: 'org', summary: { mismatch: 1 } }
    );
    expect(csv).toContain('invoice_id');
    expect(csv).toContain('delta');
  });

  it('labels appointments export', () => {
    expect(EXPORT_TYPE_LABELS.appointments).toMatch(/agenda|citas/i);
    expect(EXPORT_TYPE_LABELS.consultations).toMatch(/consulta/i);
    expect(EXPORT_TYPE_LABELS.inventory_products).toMatch(/inventario/i);
    expect(EXPORT_TYPE_LABELS.invoices).toMatch(/factura/i);
    expect(EXPORT_TYPE_LABELS.payments).toMatch(/pago/i);
    expect(EXPORT_TYPE_LABELS.cash_sessions).toMatch(/caja/i);
  });

  it('cash_sessions is export-only (phase 24)', () => {
    expect(EXPORT_TYPES).toContain('cash_sessions');
    expect(EXPORT_TYPE_LABELS.cash_sessions).toBeDefined();
    expect(IMPORT_TYPES).not.toContain('cash_sessions');
    expect(FULL_MIGRATION_STEPS).not.toContain('cash_sessions');
  });

  it('reminder_logs is export-only (phase 27)', () => {
    expect(EXPORT_TYPES).toContain('reminder_logs');
    expect(EXPORT_TYPE_LABELS.reminder_logs).toBeDefined();
    expect(IMPORT_TYPES).not.toContain('reminder_logs');
    expect(FULL_MIGRATION_STEPS).not.toContain('reminder_logs');
  });

  it('whatsapp_messages is export-only (phase 28)', () => {
    expect(EXPORT_TYPES).toContain('whatsapp_messages');
    expect(EXPORT_TYPE_LABELS.whatsapp_messages).toBeDefined();
    expect(IMPORT_TYPES).not.toContain('whatsapp_messages');
    expect(FULL_MIGRATION_STEPS).not.toContain('whatsapp_messages');
  });

  it('audit_logs is export-only (phase 29)', () => {
    expect(EXPORT_TYPES).toContain('audit_logs');
    expect(EXPORT_TYPE_LABELS.audit_logs).toBeDefined();
    expect(IMPORT_TYPES).not.toContain('audit_logs');
    expect(FULL_MIGRATION_STEPS).not.toContain('audit_logs');
  });

  it('validates consultation rows', () => {
    const issues = validateConsultationRows(
      [
        {
          rowNumber: 2,
          externalConsultationId: 'CON-001',
          externalPatientId: 'PAT-001',
          externalAppointmentId: 'APT-001',
          startedAt: '2024-10-01 10:05',
          completedAt: '2024-10-01 10:35',
          status: 'completada',
          title: 'Control',
          anamnesis: null,
          physicalExam: null,
          diagnosis: null,
          treatment: null,
          plan: null,
          weightKg: null,
          temperatureC: null,
          notes: null,
          sourceSystem: 'legacy',
        },
      ],
      { knownPatientExternalIds: new Set(['PAT-001']), locale: 'es-AR' }
    );
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(buildConsultationTemplateCsv()).toContain('external_consultation_id');
  });

  it('warns appointment overlaps in file', () => {
    const issues = validateAppointmentRows(
      [
        {
          rowNumber: 2,
          externalAppointmentId: 'A1',
          externalPatientId: 'P1',
          startsAt: '2024-10-01 10:00',
          endsAt: '2024-10-01 10:30',
          appointmentType: 'consulta',
          status: 'programada',
          title: null,
          notes: null,
          sourceSystem: null,
        },
        {
          rowNumber: 3,
          externalAppointmentId: 'A2',
          externalPatientId: 'P1',
          startsAt: '2024-10-01 10:15',
          endsAt: '2024-10-01 10:45',
          appointmentType: 'consulta',
          status: 'programada',
          title: null,
          notes: null,
          sourceSystem: null,
        },
      ],
      { knownPatientExternalIds: new Set(['P1']), locale: 'es-AR' }
    );
    expect(issues.some((i) => i.code === 'possible_overlap')).toBe(true);
  });

  it('builds migration checklist csv', () => {
    const items = [
      { key: 'owners', label: 'Owners', status: 'ok', count: 2, detail: null },
      { key: 'stuck', label: 'Locks', status: 'fail', count: 1, detail: 'x' },
    ];
    expect(summarizeMigrationChecklist(items)).toEqual({ ok: 1, warn: 0, fail: 1, total: 2 });
    expect(buildMigrationChecklistCsv(items, { organizationId: 'o1', readyForGolive: false })).toContain(
      'ready_for_golive'
    );
  });

  it('defines upload size caps', () => {
    expect(MAX_IMPORT_CSV_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_IMPORT_ZIP_BYTES).toBe(80 * 1024 * 1024);
  });

  it('builds cutover pack readme with org and go-live', () => {
    const readme = buildCutoverPackReadme({
      organizationId: 'org-cutover-1',
      generatedAt: '2026-08-21T12:00:00Z',
      readyForGolive: true,
      checklistScoreOk: 8,
      checklistScoreTotal: 8,
      orphanCreatedTotal: 0,
      orphanIdMapTotal: 0,
      stuckImports: 0,
      stuckExports: 0,
      billingMismatch: 0,
      billingPaidWithoutPayments: 0,
    });
    expect(readme).toContain('org-cutover-1');
    expect(readme.toLowerCase()).toContain('go-live');
  });

  it('isCutoverPackReady when all clear or blocked on issues', () => {
    expect(
      isCutoverPackReady({
        readyForGolive: true,
        orphanCreatedTotal: 0,
        orphanIdMapTotal: 0,
        stuckImports: 0,
        stuckExports: 0,
        billingMismatch: 0,
      })
    ).toBe(true);
    expect(
      isCutoverPackReady({
        readyForGolive: true,
        orphanCreatedTotal: 1,
        orphanIdMapTotal: 0,
        stuckImports: 0,
        stuckExports: 0,
        billingMismatch: 0,
      })
    ).toBe(false);
    expect(
      isCutoverPackReady({
        readyForGolive: true,
        orphanCreatedTotal: 0,
        orphanIdMapTotal: 0,
        stuckImports: 0,
        stuckExports: 0,
        billingMismatch: 2,
      })
    ).toBe(false);
  });

  it('defines cutover pack audit action', () => {
    expect(DATA_MIGRATION_AUDIT_ACTIONS.cutoverPackDownloaded).toBe(
      'data_migration.cutover_pack_downloaded'
    );
  });

  it('builds integrity and id-map reports', () => {
    expect(sumOrphanCounts({ owners: 2, patients: 1 })).toBe(3);
    const integrity = buildIntegrityReportCsv({
      organizationId: 'org-1',
      generatedAt: '2026-08-21T00:00:00Z',
      imports: { total: 3 },
      orphansCreated: { owners: 1 },
      stuckImports: 0,
    });
    expect(integrity).toContain('orphans_created_rows');
    expect(integrity).toContain('owners');
    const idMap = buildIdMapReportCsv([
      {
        entityType: 'owners',
        externalId: 'ext-1',
        internalId: 'uuid-1',
        createdAt: '2026-08-21T00:00:00Z',
      },
    ]);
    expect(idMap).toContain('external_id');
    expect(idMap).toContain('ext-1');
  });
});
