import {
  FALLBACK_PUBLIC_PLANS,
  isPurchasablePlanKey,
  parsePlanPricing,
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
