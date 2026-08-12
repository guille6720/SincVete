import { describe, expect, it } from 'vitest';
import { ownerSchema } from '../schemas';

describe('ownerSchema', () => {
  it('validates minimal owner', () => {
    const result = ownerSchema.safeParse({ fullName: 'Juan Pérez' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Juan Pérez');
      expect(result.data.documentType).toBe('DNI');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('trims full name', () => {
    const result = ownerSchema.safeParse({ fullName: '  María López  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('María López');
    }
  });

  it('rejects invalid email', () => {
    const result = ownerSchema.safeParse({ fullName: 'Test', email: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('clears empty optional fields', () => {
    const result = ownerSchema.safeParse({
      fullName: 'Test User',
      email: '',
      phone: '',
      branchId: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
      expect(result.data.branchId).toBeUndefined();
    }
  });
});
