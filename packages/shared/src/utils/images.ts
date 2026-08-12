import {
  CLINICAL_IMAGE_MIME_TYPES,
  type ClinicalImageMimeType,
} from '../constants/images';

const MIME_EXTENSIONS: Record<ClinicalImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export function isAllowedClinicalImageMime(mime: string): mime is ClinicalImageMimeType {
  return (CLINICAL_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function clinicalImageExtension(mime: string): string | null {
  if (!isAllowedClinicalImageMime(mime)) return null;
  return MIME_EXTENSIONS[mime];
}

export function isClinicalImagePreviewable(mime: string): boolean {
  return mime.startsWith('image/') && isAllowedClinicalImageMime(mime);
}

export function buildClinicalImageStoragePath(
  organizationId: string,
  patientId: string,
  imageId: string,
  mime: string
): string | null {
  const ext = clinicalImageExtension(mime);
  if (!ext) return null;
  return `${organizationId}/${patientId}/${imageId}.${ext}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
