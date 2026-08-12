import type { OrganizationSettings } from '../types';

export function parseOrganizationSettings(
  settings: Record<string, unknown> | null | undefined
): OrganizationSettings {
  if (!settings || typeof settings !== 'object') return {};
  return {
    timezone: typeof settings.timezone === 'string' ? settings.timezone : undefined,
    currency: typeof settings.currency === 'string' ? settings.currency : undefined,
    phone: typeof settings.phone === 'string' ? settings.phone : undefined,
    email: typeof settings.email === 'string' ? settings.email : undefined,
    taxId: typeof settings.taxId === 'string' ? settings.taxId : undefined,
  };
}

export function mergeOrganizationSettings(
  current: Record<string, unknown> | null | undefined,
  patch: OrganizationSettings
): Record<string, unknown> {
  return {
    ...(current && typeof current === 'object' ? current : {}),
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== '')),
  };
}

export function generateBranchCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
    .slice(0, 12) || 'SUC';
}
