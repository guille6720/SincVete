/**
 * Commercial feature registry (organization entitlements).
 * Distinct from PERMISSIONS (user/role capabilities).
 */

export const FEATURES = {
  DASHBOARD: 'core.dashboard',

  OWNERS: 'owners.enabled',
  PATIENTS: 'patients.enabled',
  APPOINTMENTS: 'appointments.enabled',

  CLINICAL_HISTORY: 'clinical.history',
  CONSULTATIONS: 'clinical.consultations',
  HOSPITALIZATION: 'clinical.hospitalization',
  VACCINATION: 'clinical.vaccination',
  SURGERY: 'clinical.surgery',

  LABORATORY: 'laboratory.enabled',

  INVENTORY: 'inventory.enabled',
  PHARMACY: 'pharmacy.enabled',

  BILLING: 'billing.enabled',
  CASH_REGISTER: 'cash_register.enabled',

  BASIC_REPORTS: 'reports.basic',
  ADVANCED_REPORTS: 'reports.advanced',

  OWNER_PORTAL: 'owner_portal.enabled',

  WHATSAPP: 'whatsapp.enabled',
  WHATSAPP_REMINDERS: 'whatsapp.reminders',

  NOTIFICATIONS: 'notifications.enabled',

  CLINICAL_IMAGES: 'clinical_images.enabled',

  AUDIT: 'audit.enabled',

  AI: 'ai.enabled',
  AI_PATIENT_SUMMARY: 'ai.patient_summary',
  AI_SOAP_ASSISTANT: 'ai.soap_assistant',
  AI_OWNER_INSTRUCTIONS: 'ai.owner_instructions',

  AUTOMATIONS: 'automation.enabled',

  USERS_MAX: 'users.max',
  BRANCHES_MAX: 'branches.max',
  PROFESSIONALS_MAX: 'professionals.max',
  PATIENTS_MAX: 'patients.max',
  AI_MONTHLY_REQUESTS: 'ai.monthly_requests',
  WHATSAPP_MONTHLY_MESSAGES: 'whatsapp.monthly_messages',
  STORAGE_MAX_MB: 'storage.max_mb',
  AUTOMATIONS_MAX_ACTIVE: 'automations.max_active',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_KEYS = Object.values(FEATURES) as FeatureKey[];

export const LIMIT_FEATURE_KEYS = [
  FEATURES.USERS_MAX,
  FEATURES.BRANCHES_MAX,
  FEATURES.PROFESSIONALS_MAX,
  FEATURES.PATIENTS_MAX,
  FEATURES.AI_MONTHLY_REQUESTS,
  FEATURES.WHATSAPP_MONTHLY_MESSAGES,
  FEATURES.STORAGE_MAX_MB,
  FEATURES.AUTOMATIONS_MAX_ACTIVE,
] as const satisfies readonly FeatureKey[];

export type LimitFeatureKey = (typeof LIMIT_FEATURE_KEYS)[number];

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}

export function isLimitFeatureKey(value: string): value is LimitFeatureKey {
  return (LIMIT_FEATURE_KEYS as readonly string[]).includes(value);
}

/**
 * Optional nav mapping for Phase 2+ (hide/upgrade states).
 * Phase 1 must NOT aggressively hide modules — keep for forward compatibility.
 */
export const NAV_FEATURE_BY_HREF: Record<string, FeatureKey> = {
  '/dashboard': FEATURES.DASHBOARD,
  '/propietarios': FEATURES.OWNERS,
  '/pacientes': FEATURES.PATIENTS,
  '/agenda': FEATURES.APPOINTMENTS,
  '/historia-clinica': FEATURES.CLINICAL_HISTORY,
  '/consultas': FEATURES.CONSULTATIONS,
  '/internacion': FEATURES.HOSPITALIZATION,
  '/vacunacion': FEATURES.VACCINATION,
  '/cirugias': FEATURES.SURGERY,
  '/laboratorio': FEATURES.LABORATORY,
  '/inventario': FEATURES.INVENTORY,
  '/farmacia': FEATURES.PHARMACY,
  '/facturacion': FEATURES.BILLING,
  '/caja': FEATURES.CASH_REGISTER,
  '/reportes': FEATURES.BASIC_REPORTS,
  '/portal': FEATURES.OWNER_PORTAL,
  '/whatsapp': FEATURES.WHATSAPP,
  '/recordatorios': FEATURES.WHATSAPP_REMINDERS,
  '/notificaciones': FEATURES.NOTIFICATIONS,
  '/imagenes': FEATURES.CLINICAL_IMAGES,
  '/auditoria': FEATURES.AUDIT,
  '/ia-clinica': FEATURES.AI,
};
