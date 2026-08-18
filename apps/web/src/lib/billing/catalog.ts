import {
  FALLBACK_PUBLIC_ADDONS,
  FALLBACK_PUBLIC_PLANS,
  isPurchasableAddonKey,
  isPurchasablePlanKey,
  isSeatFeatureKey,
  parsePlanPricing,
  type PublicAddonCatalogItem,
  type PublicPlanCatalogItem,
} from '@sincvete/shared';
import { createServerClient } from '@/lib/supabase/server';

function mapPublicPlans(raw: unknown): PublicPlanCatalogItem[] {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return FALLBACK_PUBLIC_PLANS;
  const mapped = parsed.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const key = typeof item.key === 'string' ? item.key : '';
    const name = typeof item.name === 'string' ? item.name : '';
    if (!key || !name || !isPurchasablePlanKey(key)) return [];
    return [
      {
        key,
        name,
        description: typeof item.description === 'string' ? item.description : null,
        displayOrder: typeof item.display_order === 'number' ? item.display_order : 0,
        pricing: parsePlanPricing(item.pricing),
      } satisfies PublicPlanCatalogItem,
    ];
  });
  return mapped.length > 0 ? mapped : FALLBACK_PUBLIC_PLANS;
}

function mapPublicAddons(raw: unknown): PublicAddonCatalogItem[] {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (!Array.isArray(parsed)) return FALLBACK_PUBLIC_ADDONS;
  const mapped = parsed.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const key = typeof item.key === 'string' ? item.key : '';
    const name = typeof item.name === 'string' ? item.name : '';
    if (!key || !name || !isPurchasableAddonKey(key)) return [];
    return [
      {
        key,
        name,
        description: typeof item.description === 'string' ? item.description : null,
        displayOrder: typeof item.display_order === 'number' ? item.display_order : 0,
        pricing: parsePlanPricing(item.pricing),
      } satisfies PublicAddonCatalogItem,
    ];
  });
  return mapped.length > 0 ? mapped : FALLBACK_PUBLIC_ADDONS;
}

export async function listPublicPlansCatalog(): Promise<PublicPlanCatalogItem[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('list_public_plans');
    if (error || data == null) return FALLBACK_PUBLIC_PLANS;
    return mapPublicPlans(data);
  } catch {
    return FALLBACK_PUBLIC_PLANS;
  }
}

export async function listPublicAddonsCatalog(): Promise<PublicAddonCatalogItem[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('list_public_addons');
    if (error || data == null) return FALLBACK_PUBLIC_ADDONS;
    return mapPublicAddons(data);
  } catch {
    return FALLBACK_PUBLIC_ADDONS;
  }
}

export async function listPublicPlanSeatLimits(
  planKey: string
): Promise<Record<string, number | null>> {
  if (!isPurchasablePlanKey(planKey)) return {};
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('list_public_plan_limits', { p_plan_key: planKey });
  if (error) {
    throw new Error(error.message);
  }
  const limits: Record<string, number | null> = {};
  for (const row of data ?? []) {
    if (!isSeatFeatureKey(row.feature_key)) continue;
    if (row.enabled === false) {
      limits[row.feature_key] = 0;
      continue;
    }
    limits[row.feature_key] = row.limit_value === null ? null : Number(row.limit_value);
  }
  return limits;
}
