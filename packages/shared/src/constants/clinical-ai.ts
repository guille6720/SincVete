export const CLINICAL_AI_KINDS = [
  'patient_summary',
  'soap_assist',
  'owner_instructions',
] as const;

export type ClinicalAiKind = (typeof CLINICAL_AI_KINDS)[number];

export const CLINICAL_AI_KIND_LABELS: Record<ClinicalAiKind, string> = {
  patient_summary: 'Resumen del paciente',
  soap_assist: 'Asistente SOAP',
  owner_instructions: 'Indicaciones al tutor',
};

export const CLINICAL_AI_DISCLAIMER =
  'La IA no reemplaza el criterio clínico. Revisá y editá la sugerencia antes de guardarla en la historia.';

export const CLINICAL_AI_SYSTEM_PROMPT =
  'Sos un asistente clínico veterinario para clínicas de Argentina y LATAM. ' +
  'Respondé SOLO con JSON válido. Las claves van en inglés exactamente como se te piden. ' +
  'Los valores van en español rioplatense, concisos y accionables. ' +
  'No inventes estudios, fármacos ni hallazgos que no estén en el contexto. ' +
  'Si falta información, dejalo explícito. No sos un diagnóstico definitivo.';

export function buildClinicalAiPath(params: {
  patientId?: string;
  kind?: ClinicalAiKind;
  consultationId?: string;
  clinicalEntryId?: string;
}): string {
  const search = new URLSearchParams();
  if (params.patientId) search.set('patientId', params.patientId);
  if (params.kind) search.set('kind', params.kind);
  if (params.consultationId) search.set('consultationId', params.consultationId);
  if (params.clinicalEntryId) search.set('clinicalEntryId', params.clinicalEntryId);
  const query = search.toString();
  return query ? `/ia-clinica?${query}` : '/ia-clinica';
}
