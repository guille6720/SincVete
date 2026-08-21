'use client';

import { useMemo, useState } from 'react';
import {
  EXPORT_TYPE_LABELS,
  IMPORT_TYPE_LABELS,
  type ExportFormat,
  type ExportType,
  type ImportType,
  type ValidationIssue,
} from '@sincvete/shared';
import {
  commitDataImport,
  downloadImportTemplate,
  listDataExportJobsAction,
  listDataImportBatchesAction,
  rollbackDataImportAction,
  runClinicExportAction,
  startDataImport,
  validateDataImport,
} from '@/actions/data-migration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

type Section = 'import' | 'export' | 'history-import' | 'history-export';

function downloadBase64(filename: string, contentType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataMigrationPanel({
  canImport,
  canExport,
}: {
  canImport: boolean;
  canExport: boolean;
}) {
  const [pending, run] = usePendingAction();
  const [section, setSection] = useState<Section>(canImport ? 'import' : 'export');
  const [message, setMessage] = useState<string | null>(null);

  const [importType, setImportType] = useState<ImportType>('owners');
  const [sourceSystem, setSourceSystem] = useState('VetLegacy');
  const [csvText, setCsvText] = useState('');
  const [sourceFilename, setSourceFilename] = useState('upload.csv');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [validation, setValidation] = useState<{
    detected: number;
    ready: number;
    warnings: number;
    errors: number;
    issues: ValidationIssue[];
  } | null>(null);
  const [ownerIdByExternal, setOwnerIdByExternal] = useState<Record<string, string>>({});
  const [patientIdByExternal, setPatientIdByExternal] = useState<Record<string, string>>({});
  const [importReport, setImportReport] = useState<string | null>(null);

  const [exportType, setExportType] = useState<ExportType>('owners');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [patientId, setPatientId] = useState('');

  const [importHistory, setImportHistory] = useState<Array<Record<string, unknown>>>([]);
  const [exportHistory, setExportHistory] = useState<Array<Record<string, unknown>>>([]);

  const entity = useMemo(() => {
    if (importType === 'patients') return 'patients' as const;
    if (importType === 'clinical_entries' || importType === 'vaccinations') {
      return 'clinical_entries' as const;
    }
    if (importType === 'full_migration') return 'owners' as const;
    return 'owners' as const;
  }, [importType]);

  async function onDownloadTemplate(kind: 'owners' | 'patients' | 'clinical_entries') {
    setMessage(null);
    const form = new FormData();
    form.set('kind', kind);
    const result = await run(() => downloadImportTemplate(form));
    if (!result?.success || !result.data) {
      setMessage(result?.error ?? 'No se pudo descargar la plantilla');
      return;
    }
    downloadText(result.data.filename, result.data.csv);
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setSourceFilename(file.name);
    const text = await file.text();
    setCsvText(text);
    setValidation(null);
    setImportReport(null);
  }

  async function onAnalyze() {
    setMessage(null);
    const form = new FormData();
    form.set('importType', importType);
    form.set('entity', entity);
    form.set('csvText', csvText);
    form.set('sourceFilename', sourceFilename);
    form.set('sourceSystem', sourceSystem);
    const result = await run(() => startDataImport(form));
    if (!result?.success || !result.data) {
      setMessage(result?.error ?? 'No se pudo analizar el archivo');
      return;
    }
    setBatchId(result.data.batchId);
    setMapping(result.data.mapping);
    setHeaders(result.data.headers);
    setMessage(`Archivo analizado · ${result.data.rowCount} filas · mapeá columnas y validá`);
  }

  async function onValidate() {
    if (!batchId) return;
    setMessage(null);
    const form = new FormData();
    form.set('batchId', batchId);
    form.set('entity', entity);
    form.set('csvText', csvText);
    form.set('mapping', JSON.stringify(mapping));
    form.set('knownOwnerExternalIds', Object.keys(ownerIdByExternal).join(','));
    form.set('knownPatientExternalIds', Object.keys(patientIdByExternal).join(','));
    const result = await run(() => validateDataImport(form));
    if (!result?.success || !result.data) {
      setMessage(result?.error ?? 'Validación fallida');
      return;
    }
    setValidation({
      detected: result.data.detected,
      ready: result.data.ready,
      warnings: result.data.warnings,
      errors: result.data.errors,
      issues: result.data.issues as ValidationIssue[],
    });
    setMessage(
      `${result.data.detected} detectados · ${result.data.ready} listos · ${result.data.warnings} avisos · ${result.data.errors} errores`
    );
  }

  async function onCommit() {
    if (!batchId || !validation || validation.errors > 0) {
      setMessage('Corregí errores bloqueantes antes de importar');
      return;
    }
    const form = new FormData();
    form.set('batchId', batchId);
    form.set('entity', entity);
    form.set('csvText', csvText);
    form.set('mapping', JSON.stringify(mapping));
    form.set('ownerIdByExternal', JSON.stringify(ownerIdByExternal));
    form.set('patientIdByExternal', JSON.stringify(patientIdByExternal));
    form.set('sourceSystem', sourceSystem);
    const result = await run(() => commitDataImport(form));
    if (!result?.success || !result.data) {
      setMessage(result?.error ?? 'Importación fallida');
      return;
    }
    if (entity === 'owners') {
      setOwnerIdByExternal((prev) => ({ ...prev, ...result.data!.idMap }));
    }
    if (entity === 'patients') {
      setPatientIdByExternal((prev) => ({ ...prev, ...result.data!.idMap }));
    }
    setImportReport(
      `Import ${result.data.status}: ${result.data.imported} ok · ${result.data.failed} fallidos`
    );
    setMessage(null);
  }

  async function onExport() {
    setMessage(null);
    const form = new FormData();
    form.set('exportType', exportType);
    form.set('format', exportFormat);
    if (patientId) form.set('patientId', patientId);
    const result = await run(() => runClinicExportAction(form));
    if (!result?.success || !result.data) {
      setMessage(result?.error ?? 'Exportación fallida');
      return;
    }
    downloadBase64(result.data.filename, result.data.contentType, result.data.base64);
    setMessage(
      `Export listo · propietarios ${result.data.recordCounts.owners ?? 0} · pacientes ${result.data.recordCounts.patients ?? 0}`
    );
  }

  async function refreshImportHistory() {
    const result = await run(() => listDataImportBatchesAction());
    if (result?.success && result.data) setImportHistory(result.data as Array<Record<string, unknown>>);
  }

  async function refreshExportHistory() {
    const result = await run(() => listDataExportJobsAction());
    if (result?.success && result.data) setExportHistory(result.data as Array<Record<string, unknown>>);
  }

  async function onRollback(id: string) {
    const form = new FormData();
    form.set('batchId', id);
    const result = await run(() => rollbackDataImportAction(form));
    if (!result?.success) {
      setMessage(result?.error ?? 'No se pudo revertir');
      return;
    }
    setMessage(`Rollback: ${result.data?.rolledBack ?? 0} filas afectadas`);
    await refreshImportHistory();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canImport ? (
          <Button
            type="button"
            size="sm"
            variant={section === 'import' ? 'default' : 'outline'}
            onClick={() => setSection('import')}
          >
            Importar datos
          </Button>
        ) : null}
        {canExport ? (
          <Button
            type="button"
            size="sm"
            variant={section === 'export' ? 'default' : 'outline'}
            onClick={() => setSection('export')}
          >
            Exportar datos
          </Button>
        ) : null}
        {canImport ? (
          <Button
            type="button"
            size="sm"
            variant={section === 'history-import' ? 'default' : 'outline'}
            onClick={() => {
              setSection('history-import');
              void refreshImportHistory();
            }}
          >
            Historial de importación
          </Button>
        ) : null}
        {canExport ? (
          <Button
            type="button"
            size="sm"
            variant={section === 'history-export' ? 'default' : 'outline'}
            onClick={() => {
              setSection('history-export');
              void refreshExportHistory();
            }}
          >
            Historial de exportación
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {importReport ? <p className="text-sm font-medium">{importReport}</p> : null}

      {section === 'import' && canImport ? (
        <Card>
          <CardHeader>
            <CardTitle>Importar datos</CardTitle>
            <CardDescription>
              Wizard seguro con dry-run, detección de duplicados y sin sobrescritura silenciosa.
              No modifica producción fuera de tu organización.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Qué importar</Label>
                <Select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as ImportType)}
                >
                  {(Object.keys(IMPORT_TYPE_LABELS) as ImportType[]).map((key) => (
                    <option key={key} value={key}>
                      {IMPORT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sistema origen</Label>
                <Input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void onDownloadTemplate('owners')}>
                Plantilla propietarios
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void onDownloadTemplate('patients')}>
                Plantilla pacientes
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void onDownloadTemplate('clinical_entries')}>
                Plantilla historias
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="importFile">Subir CSV / JSON textual</Label>
              <Input
                id="importFile"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || !csvText} onClick={() => void onAnalyze()}>
                Analizar y mapear
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !batchId}
                onClick={() => void onValidate()}
              >
                Validar (dry-run)
              </Button>
              <Button
                type="button"
                disabled={pending || !validation || validation.errors > 0}
                onClick={() => void onCommit()}
              >
                Confirmar importación
              </Button>
            </div>

            {headers.length > 0 ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Mapeo de columnas</p>
                {Object.entries(mapping).map(([field, source]) => (
                  <div key={field} className="grid gap-2 sm:grid-cols-2">
                    <Label className="text-xs text-muted-foreground">{field}</Label>
                    <Select
                      value={source ?? ''}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field]: e.target.value || null,
                        }))
                      }
                    >
                      <option value="">— sin mapear —</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}

            {validation ? (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p>
                  Detectados: {validation.detected} · Listos: {validation.ready} · Avisos:{' '}
                  {validation.warnings} · Errores: {validation.errors}
                </p>
                {validation.issues.length > 0 ? (
                  <ul className="max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {validation.issues.slice(0, 40).map((issue, idx) => (
                      <li key={`${issue.rowNumber}-${issue.code}-${idx}`}>
                        Fila {issue.rowNumber}: [{issue.severity}] {issue.message}
                        {issue.recommendedAction ? ` → ${issue.recommendedAction}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {importType === 'full_migration' ? (
              <p className="text-xs text-muted-foreground">
                Migración completa: importá primero propietarios, luego pacientes (usando los IDs
                externos del lote), después historias clínicas. El orden respeta dependencias.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === 'export' && canExport ? (
        <Card>
          <CardHeader>
            <CardTitle>Exportar datos</CardTitle>
            <CardDescription>
              Exportá por entidad o clínica completa. PDF clínico se entrega como HTML imprimible
              profesional (imprimir → PDF). ZIP incluye JSON estructurado + manifiesto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Qué exportar</Label>
                <Select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                >
                  {(Object.keys(EXPORT_TYPE_LABELS) as ExportType[]).map((key) => (
                    <option key={key} value={key}>
                      {EXPORT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Formato</Label>
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                >
                  <option value="csv">CSV (Excel)</option>
                  <option value="json">JSON</option>
                  <option value="zip">ZIP completo</option>
                  <option value="pdf">PDF / HTML clínico</option>
                </Select>
              </div>
            </div>
            {(exportType === 'patient_clinical' || exportFormat === 'pdf') && (
              <div className="space-y-1">
                <Label>ID paciente (UUID SyncVete)</Label>
                <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
              </div>
            )}
            <Button type="button" disabled={pending} onClick={() => void onExport()}>
              Generar exportación
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {section === 'history-import' && canImport ? (
        <Card>
          <CardHeader>
            <CardTitle>Historial de importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {importHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin lotes todavía.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {importHistory.map((batch) => (
                  <li key={String(batch.id)} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {String(batch.import_type)} · {String(batch.status)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {String(batch.created_at)} · archivo {String(batch.source_filename ?? '—')} ·
                          importados {String(batch.imported_records ?? 0)}
                        </p>
                      </div>
                      {['completed', 'completed_with_warnings'].includes(String(batch.status)) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => void onRollback(String(batch.id))}
                        >
                          Rollback
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {section === 'history-export' && canExport ? (
        <Card>
          <CardHeader>
            <CardTitle>Historial de exportación</CardTitle>
          </CardHeader>
          <CardContent>
            {exportHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin exportaciones todavía.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {exportHistory.map((job) => (
                  <li key={String(job.id)} className="rounded-md border px-3 py-2">
                    {String(job.export_type)} · {String(job.format)} · {String(job.status)} ·{' '}
                    {String(job.created_at)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
