export const ROLES = [
  'owner',
  'admin',
  'veterinarian',
  'nurse',
  'receptionist',
  'cashier',
  'lab_tech',
  'readonly',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  veterinarian: 'Veterinario',
  nurse: 'Enfermero/a',
  receptionist: 'Recepcionista',
  cashier: 'Cajero/a',
  lab_tech: 'Técnico de laboratorio',
  readonly: 'Solo lectura',
};

export const PERMISSIONS = [
  'org:manage',
  'branch:manage',
  'users:manage',
  'patients:read',
  'patients:write',
  'appointments:read',
  'appointments:write',
  'clinical:read',
  'clinical:write',
  'billing:read',
  'billing:write',
  'inventory:read',
  'inventory:write',
  'reports:read',
  'audit:read',
  'whatsapp:send',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [
    'org:manage',
    'branch:manage',
    'users:manage',
    'patients:read',
    'patients:write',
    'appointments:read',
    'appointments:write',
    'clinical:read',
    'clinical:write',
    'billing:read',
    'billing:write',
    'inventory:read',
    'inventory:write',
    'reports:read',
    'audit:read',
    'whatsapp:send',
  ],
  veterinarian: [
    'patients:read',
    'patients:write',
    'appointments:read',
    'appointments:write',
    'clinical:read',
    'clinical:write',
    'inventory:read',
    'reports:read',
    'whatsapp:send',
  ],
  nurse: [
    'patients:read',
    'patients:write',
    'appointments:read',
    'appointments:write',
    'clinical:read',
    'clinical:write',
    'inventory:read',
    'whatsapp:send',
  ],
  receptionist: [
    'patients:read',
    'patients:write',
    'appointments:read',
    'appointments:write',
    'billing:read',
    'whatsapp:send',
  ],
  cashier: ['patients:read', 'appointments:read', 'billing:read', 'billing:write', 'whatsapp:send'],
  lab_tech: ['patients:read', 'clinical:read', 'clinical:write', 'inventory:read', 'whatsapp:send'],
  readonly: ['patients:read', 'appointments:read', 'clinical:read', 'reports:read'],
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const SEARCH_DEBOUNCE_MS = 300;

export const APP_NAME = 'SyncVete';
export const APP_LOCALE = 'es-AR';
export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';
