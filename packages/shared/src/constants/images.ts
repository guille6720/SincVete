export const CLINICAL_IMAGE_KINDS = [
  'foto',
  'radiografia',
  'ecografia',
  'laboratorio',
  'documento',
  'otro',
] as const;

export type ClinicalImageKind = (typeof CLINICAL_IMAGE_KINDS)[number];

export const CLINICAL_IMAGE_KIND_LABELS: Record<ClinicalImageKind, string> = {
  foto: 'Foto clínica',
  radiografia: 'Radiografía',
  ecografia: 'Ecografía',
  laboratorio: 'Laboratorio',
  documento: 'Documento',
  otro: 'Otro',
};

export const CLINICAL_IMAGE_KIND_VARIANT: Record<
  ClinicalImageKind,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  foto: 'default',
  radiografia: 'warning',
  ecografia: 'success',
  laboratorio: 'default',
  documento: 'default',
  otro: 'default',
};

export const CLINICAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const CLINICAL_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export type ClinicalImageMimeType = (typeof CLINICAL_IMAGE_MIME_TYPES)[number];

export const CLINICAL_IMAGE_ACCEPT = CLINICAL_IMAGE_MIME_TYPES.join(',');
