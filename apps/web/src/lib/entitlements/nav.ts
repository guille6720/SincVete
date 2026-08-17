import type { FeatureKey } from '@sincvete/shared';
import { NAV_FEATURE_BY_HREF } from '@sincvete/shared';

/**
 * Maps clinic nav href → commercial feature key.
 * Phase 1: do NOT hide modules based on this map (backward compatible).
 * Phase 2 Superadmin / UX upgrade states can use it safely.
 */
export function getNavFeatureKey(href: string): FeatureKey | null {
  if (NAV_FEATURE_BY_HREF[href]) return NAV_FEATURE_BY_HREF[href];
  const base = Object.keys(NAV_FEATURE_BY_HREF).find(
    (key) => href === key || href.startsWith(`${key}/`)
  );
  return base ? NAV_FEATURE_BY_HREF[base] : null;
}
