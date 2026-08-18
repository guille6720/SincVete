import {
  COMMERCIAL_PLAN_KEYS,
  PUBLIC_PRICING_PLAN_KEYS,
  type CommercialPlanKey,
} from '../constants/features';

export const BILLING_PROVIDERS = ['stripe', 'mercadopago'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type PublicPlanCta = 'register' | 'checkout' | 'contact';

export interface PlanPricing {
  currency: string;
  monthlyAmount: number | null;
  annualAmount: number | null;
  recommended: boolean;
  cta: PublicPlanCta;
  highlights: string[];
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  mercadopagoPreapprovalPlanId: string | null;
}

export interface PublicPlanCatalogItem {
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
  pricing: PlanPricing;
}

const EMPTY_PRICING: PlanPricing = {
  currency: 'ARS',
  monthlyAmount: null,
  annualAmount: null,
  recommended: false,
  cta: 'contact',
  highlights: [],
  stripePriceIdMonthly: null,
  stripePriceIdAnnual: null,
  mercadopagoPreapprovalPlanId: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return null;
}

function asCta(value: unknown): PublicPlanCta {
  if (value === 'register' || value === 'checkout' || value === 'contact') return value;
  return 'checkout';
}

function asHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

export function parsePlanPricing(raw: unknown): PlanPricing {
  const row = asRecord(raw);
  if (!row) return { ...EMPTY_PRICING };

  return {
    currency: asString(row.currency) ?? 'ARS',
    monthlyAmount: asAmount(row.monthly_amount ?? row.monthlyAmount),
    annualAmount: asAmount(row.annual_amount ?? row.annualAmount),
    recommended: asBoolean(row.recommended),
    cta: asCta(row.cta),
    highlights: asHighlights(row.highlights),
    stripePriceIdMonthly: asString(row.stripe_price_id_monthly ?? row.stripePriceIdMonthly),
    stripePriceIdAnnual: asString(row.stripe_price_id_annual ?? row.stripePriceIdAnnual),
    mercadopagoPreapprovalPlanId: asString(
      row.mercadopago_preapproval_plan_id ?? row.mercadopagoPreapprovalPlanId
    ),
  };
}

export function formatArsAmount(amount: number | null): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat('es-AR').format(amount);
}

export function amountForInterval(pricing: PlanPricing, interval: BillingInterval): number | null {
  return interval === 'annual' ? pricing.annualAmount : pricing.monthlyAmount;
}

export function isPurchasablePlanKey(planKey: string): boolean {
  return (PUBLIC_PRICING_PLAN_KEYS as readonly string[]).includes(planKey);
}

export function canCheckoutPlan(pricing: PlanPricing): boolean {
  return pricing.cta !== 'contact' && pricing.monthlyAmount !== null;
}

export function encodeCheckoutReference(params: {
  organizationId: string;
  planKey: string;
  interval: BillingInterval;
}): string {
  return `${params.organizationId}:${params.planKey}:${params.interval}`;
}

export function parseCheckoutReference(raw: string | null | undefined): {
  organizationId: string;
  planKey: string;
  interval: BillingInterval;
} | null {
  if (!raw) return null;
  const [organizationId, planKey, interval] = raw.split(':');
  if (!organizationId || !planKey) return null;
  if (!isPurchasablePlanKey(planKey)) return null;
  const resolvedInterval: BillingInterval = interval === 'annual' ? 'annual' : 'monthly';
  return { organizationId, planKey, interval: resolvedInterval };
}

export function isBillingProvider(value: string | null | undefined): value is BillingProvider {
  return value === 'stripe' || value === 'mercadopago';
}

/** Fallback catalog if list_public_plans is unavailable (migration not applied yet). */
export const FALLBACK_PUBLIC_PLANS: PublicPlanCatalogItem[] = [
  {
    key: COMMERCIAL_PLAN_KEYS.BASIC,
    name: 'Basic',
    description: 'Operación clínica esencial',
    displayOrder: 10,
    pricing: {
      ...EMPTY_PRICING,
      monthlyAmount: 29990,
      annualAmount: 299900,
      cta: 'checkout',
      highlights: [
        'Agenda, pacientes e historia clínica',
        'Vacunación y notificaciones',
        'Hasta 3 usuarios y 1 sucursal',
        'Hasta 500 pacientes activos',
        '1 GB de almacenamiento',
      ],
    },
  },
  {
    key: COMMERCIAL_PLAN_KEYS.PRO,
    name: 'Pro',
    description: 'Clínica completa con facturación e inventario',
    displayOrder: 20,
    pricing: {
      ...EMPTY_PRICING,
      monthlyAmount: 39900,
      annualAmount: 399000,
      recommended: true,
      cta: 'checkout',
      highlights: [
        'Todo Basic + internación, cirugías y laboratorio',
        'Inventario, farmacia, facturación y caja',
        'Reportes básicos, portal del tutor y auditoría',
        'Hasta 10 usuarios y 3 sucursales',
        '10 GB de almacenamiento',
      ],
    },
  },
  {
    key: COMMERCIAL_PLAN_KEYS.PREMIUM,
    name: 'Premium',
    description: 'Pro + IA, WhatsApp y automatizaciones',
    displayOrder: 30,
    pricing: {
      ...EMPTY_PRICING,
      monthlyAmount: 54900,
      annualAmount: 549000,
      cta: 'checkout',
      highlights: [
        'Todo Pro + IA clínica y WhatsApp',
        'Imágenes clínicas y reportes avanzados',
        'Hasta 25 usuarios y 10 sucursales',
        'Pacientes ilimitados',
        '50 GB de almacenamiento',
      ],
    },
  },
  {
    key: COMMERCIAL_PLAN_KEYS.ENTERPRISE,
    name: 'Enterprise',
    description: 'Todo disponible + límites personalizados',
    displayOrder: 40,
    pricing: {
      ...EMPTY_PRICING,
      cta: 'contact',
      highlights: [
        'Todo Premium con límites a medida',
        'Multi-sucursal y cupos personalizados',
        'Acompañamiento de onboarding',
        'Facturación y contrato a medida',
      ],
    },
  },
];

export type { CommercialPlanKey };
