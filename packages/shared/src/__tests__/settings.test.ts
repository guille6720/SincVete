import { describe, expect, it } from 'vitest';
import {
  generateBranchCode,
  mergeOrganizationSettings,
  parseOrganizationSettings,
} from '../utils/settings';

describe('parseOrganizationSettings', () => {
  it('returns defaults for empty input', () => {
    expect(parseOrganizationSettings(null)).toEqual({});
    expect(parseOrganizationSettings({})).toEqual({});
  });

  it('parses known fields', () => {
    expect(
      parseOrganizationSettings({
        timezone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        phone: '123',
      })
    ).toEqual({
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      phone: '123',
    });
  });
});

describe('mergeOrganizationSettings', () => {
  it('merges settings without dropping unknown keys', () => {
    const result = mergeOrganizationSettings({ custom: true }, { currency: 'USD' });
    expect(result).toEqual({ custom: true, currency: 'USD' });
  });
});

describe('generateBranchCode', () => {
  it('generates uppercase code from name', () => {
    expect(generateBranchCode('Sucursal Norte')).toBe('SUCURSAL_NOR');
  });
});
