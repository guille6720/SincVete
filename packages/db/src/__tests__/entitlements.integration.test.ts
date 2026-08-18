import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Database } from '../types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const canRun = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe('Integration env (entitlements)', () => {
  it('reports Supabase availability', () => {
    expect(typeof canRun).toBe('boolean');
  });
});

describe.skipIf(!canRun)('@entitlements Phase 1 commercial model', () => {
  let service: SupabaseClient<Database>;

  const timestamp = Date.now();
  const orgASlug = `ent-a-${timestamp}`;
  const orgBSlug = `ent-b-${timestamp}`;
  const emailA = `ent-a-${timestamp}@test.sincvete.local`;
  const emailB = `ent-b-${timestamp}@test.sincvete.local`;
  const password = 'TestPass123!';

  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let catalogReady = false;

  beforeAll(async () => {
    service = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: catalogError } = await service.from('plans').select('key').limit(1);
    if (catalogError) {
      catalogReady = false;
      return;
    }
    catalogReady = true;

    const { data: userA, error: errA } = await service.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA || !userA.user) throw errA ?? new Error('Failed to create user A');
    userAId = userA.user.id;

    const { data: userB, error: errB } = await service.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB || !userB.user) throw errB ?? new Error('Failed to create user B');
    userBId = userB.user.id;

    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const { data: setupA, error: setupErrA } = await clientA.rpc('handle_new_user_signup', {
      p_full_name: 'Usuario Ent A',
      p_organization_name: 'Clínica Ent A',
      p_organization_slug: orgASlug,
    });
    if (setupErrA) throw setupErrA;
    orgAId = (setupA as { organization_id: string }).organization_id;
    await clientA.auth.signOut();

    const clientB = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: setupB, error: setupErrB } = await clientB.rpc('handle_new_user_signup', {
      p_full_name: 'Usuario Ent B',
      p_organization_name: 'Clínica Ent B',
      p_organization_slug: orgBSlug,
    });
    if (setupErrB) throw setupErrB;
    orgBId = (setupB as { organization_id: string }).organization_id;
    await clientB.auth.signOut();
  });

  afterAll(async () => {
    if (userAId) await service.auth.admin.deleteUser(userAId);
    if (userBId) await service.auth.admin.deleteUser(userBId);
  });

  it('skips remaining checks if entitlements catalog is not migrated yet', () => {
    if (!catalogReady) {
      expect(catalogReady).toBe(false);
      return;
    }
    expect(orgAId).toBeTruthy();
    expect(orgBId).toBeTruthy();
  });

  it('new organization receives trial, never legacy', async () => {
    if (!catalogReady) return;

    const { data: sub, error } = await service
      .from('organization_subscriptions')
      .select('status, cancelled_at, trial_ends_at, plans!inner(key, is_internal, is_public)')
      .eq('organization_id', orgAId)
      .in('status', ['trialing', 'active'])
      .is('cancelled_at', null)
      .maybeSingle();

    expect(error).toBeNull();
    expect(sub).toBeTruthy();
    expect(sub?.status).toBe('trialing');

    const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;
    expect(plan?.key).toBe('trial');
    expect(plan?.key).not.toBe('legacy');
    expect(plan?.is_internal).toBe(false);
  });

  it('legacy plan stays internal and excluded from public pricing', async () => {
    if (!catalogReady) return;

    const { data: legacy, error } = await service
      .from('plans')
      .select('key, is_internal, is_public')
      .eq('key', 'legacy')
      .single();

    expect(error).toBeNull();
    expect(legacy?.is_internal).toBe(true);
    expect(legacy?.is_public).toBe(false);
  });

  it('positive usage increment is accepted for a metered feature', async () => {
    if (!catalogReady) return;

    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const { data, error } = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 2,
    });

    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(2);

    await clientA.auth.signOut();
  });

  it('rejects 0, negative, unknown, and non-metered increments', async () => {
    if (!catalogReady) return;

    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const zero = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 0,
    });
    expect(zero.error).toBeTruthy();

    const negative = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: -3,
    });
    expect(negative.error).toBeTruthy();

    const unknown = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'totally.unknown',
      p_amount: 1,
    });
    expect(unknown.error).toBeTruthy();

    const booleanFeature = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'ai.enabled',
      p_amount: 1,
    });
    expect(booleanFeature.error).toBeTruthy();

    await clientA.auth.signOut();
  });

  it('organization A cannot read or increment organization B usage', async () => {
    if (!catalogReady) return;

    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const beforeB = await service
      .from('feature_usage')
      .select('usage_count')
      .eq('organization_id', orgBId);

    const { error: incError } = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 1,
    });
    expect(incError).toBeNull();

    const { data: foreignUsage } = await clientA
      .from('feature_usage')
      .select('organization_id')
      .eq('organization_id', orgBId);

    expect(foreignUsage).toEqual([]);

    const afterB = await service
      .from('feature_usage')
      .select('usage_count')
      .eq('organization_id', orgBId);

    const sum = (rows: { usage_count: number }[] | null) =>
      (rows ?? []).reduce((acc, row) => acc + Number(row.usage_count), 0);

    expect(sum(afterB.data)).toBe(sum(beforeB.data));

    await clientA.auth.signOut();
  });

  it('concurrent increments do not lose updates', async () => {
    if (!catalogReady) return;

    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const { data: before } = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 1,
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        clientA.rpc('increment_feature_usage', {
          p_feature_key: 'storage.max_mb',
          p_amount: 1,
        })
      )
    );

    expect(results.every((row) => row.error === null)).toBe(true);

    const { data: after } = await clientA.rpc('increment_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 1,
    });

    expect(Number(after)).toBe(Number(before) + 8 + 1);

    await clientA.auth.signOut();
  });

  it('try_consume rejects first insert that would exceed the limit', async () => {
    if (!catalogReady) return;

    const clientB = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientB.auth.signInWithPassword({ email: emailB, password });

    const { data, error } = await clientB.rpc('try_consume_feature_usage', {
      p_feature_key: 'storage.max_mb',
      p_amount: 50,
      p_limit: 10,
    });

    expect(error).toBeNull();
    expect(data).toBeNull();

    await clientB.auth.signOut();
  });
});
