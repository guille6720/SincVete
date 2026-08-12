import { describe, expect, it } from 'vitest';
import { clinicalImageCreateSchema } from '../schemas';
import {
  buildClinicalImageStoragePath,
  clinicalImageExtension,
  formatFileSize,
  isAllowedClinicalImageMime,
  isClinicalImagePreviewable,
} from '../utils/images';

describe('clinicalImageCreateSchema', () => {
  const validPatientId = '550e8400-e29b-41d4-a716-446655440000';
  const validOwnerId = '550e8400-e29b-41d4-a716-446655440001';

  it('validates metadata for an upload', () => {
    const result = clinicalImageCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      kind: 'radiografia',
      title: 'Tórax LD',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid kind', () => {
    const result = clinicalImageCreateSchema.safeParse({
      patientId: validPatientId,
      ownerId: validOwnerId,
      kind: 'mri',
    });
    expect(result.success).toBe(false);
  });
});

describe('clinical image helpers', () => {
  it('accepts jpeg and pdf', () => {
    expect(isAllowedClinicalImageMime('image/jpeg')).toBe(true);
    expect(isAllowedClinicalImageMime('application/pdf')).toBe(true);
    expect(isAllowedClinicalImageMime('image/svg+xml')).toBe(false);
  });

  it('builds a tenant-scoped storage path', () => {
    expect(
      buildClinicalImageStoragePath(
        'org-1',
        'pat-1',
        'img-1',
        'image/jpeg'
      )
    ).toBe('org-1/pat-1/img-1.jpg');
  });

  it('returns null for an unsupported mime', () => {
    expect(clinicalImageExtension('text/plain')).toBeNull();
    expect(isClinicalImagePreviewable('application/pdf')).toBe(false);
    expect(isClinicalImagePreviewable('image/png')).toBe(true);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
