import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Database } from '../types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const canRun = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe('Integration env', () => {
  it('reports Supabase availability', () => {
    expect(typeof canRun).toBe('boolean');
  });
});

describe.skipIf(!canRun)('@rls Multi-tenant isolation', () => {
  let service: SupabaseClient<Database>;

  const timestamp = Date.now();
  const orgASlug = `clinica-a-${timestamp}`;
  const orgBSlug = `clinica-b-${timestamp}`;
  const emailA = `user-a-${timestamp}@test.sincvete.local`;
  const emailB = `user-b-${timestamp}@test.sincvete.local`;
  const password = 'TestPass123!';

  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    service = createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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
      p_full_name: 'Usuario A',
      p_organization_name: 'Clínica A',
      p_organization_slug: orgASlug,
    });
    if (setupErrA) throw setupErrA;
    orgAId = (setupA as { organization_id: string }).organization_id;
    await clientA.auth.signOut();

    const clientB = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const { data: setupB, error: setupErrB } = await clientB.rpc('handle_new_user_signup', {
      p_full_name: 'Usuario B',
      p_organization_name: 'Clínica B',
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

  it('user A cannot read organization B', async () => {
    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const { data, error } = await clientA
      .from('organizations')
      .select('*')
      .eq('id', orgBId);

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: ownOrg } = await clientA
      .from('organizations')
      .select('id')
      .eq('id', orgAId)
      .single();

    expect(ownOrg?.id).toBe(orgAId);

    await clientA.auth.signOut();
  });

  it('user A cannot read profiles from organization B', async () => {
    const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
    await clientA.auth.signInWithPassword({ email: emailA, password });

    const { data } = await clientA.from('profiles').select('*').eq('id', userBId);

    expect(data).toEqual([]);
    await clientA.auth.signOut();
  });
});
