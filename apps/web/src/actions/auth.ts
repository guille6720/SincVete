'use server';

import { redirect } from 'next/navigation';
import {
  getPermissionsForRole,
  signInSchema,
  signUpSchema,
  type ActionResult,
  type SessionContext,
} from '@sincvete/shared';
import type { Permission, Role } from '@sincvete/shared';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export async function signIn(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { success: false, error: 'Email o contraseña incorrectos' };
  }

  const redirectTo = formData.get('redirectTo');
  if (typeof redirectTo === 'string' && redirectTo.startsWith('/portal/activar')) {
    redirect(redirectTo);
  }

  redirect('/home');
}

export async function signUp(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    organizationName: formData.get('organizationName'),
    organizationSlug: formData.get('organizationSlug'),
    branchName: formData.get('branchName') || 'Sucursal Principal',
  });

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createServerClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (authError || !authData.user) {
    return {
      success: false,
      error: authError?.message ?? 'No se pudo crear la cuenta',
    };
  }

  const { error: setupError } = await supabase.rpc('handle_new_user_signup', {
    p_full_name: parsed.data.fullName,
    p_organization_name: parsed.data.organizationName,
    p_organization_slug: parsed.data.organizationSlug,
    p_branch_name: parsed.data.branchName,
  });

  if (setupError) {
    const service = await createServiceClient();
    await service.auth.admin.deleteUser(authData.user.id);
    return {
      success: false,
      error: setupError.message.includes('slug')
        ? 'El identificador de clínica ya está en uso'
        : 'No se pudo configurar la clínica',
    };
  }

  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from('branch_members')
    .select('branch_id, role, permissions')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const activeMembership =
    memberships?.find((m) => m.branch_id === profile.active_branch_id) ??
    memberships?.[0] ??
    null;

  if (activeMembership) {
    const role = activeMembership.role as Role;
    const customPerms = activeMembership.permissions as Permission[] | null;

    return {
      userId: user.id,
      organizationId: profile.organization_id,
      branchId: activeMembership.branch_id,
      kind: 'staff',
      role,
      permissions: getPermissionsForRole(role, customPerms),
      profile: {
        id: profile.id,
        organization_id: profile.organization_id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
        active_branch_id: profile.active_branch_id,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        deleted_at: profile.deleted_at,
      },
      ownerId: null,
    };
  }

  const { data: portalOwnerId } = await supabase.rpc('get_portal_owner_id');
  if (!portalOwnerId) return null;

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    branchId: null,
    kind: 'portal',
    role: null,
    permissions: [],
    profile: {
      id: profile.id,
      organization_id: profile.organization_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      phone: profile.phone,
      active_branch_id: profile.active_branch_id,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      deleted_at: profile.deleted_at,
    },
    ownerId: portalOwnerId,
  };
}

export async function getOrganizationBranches() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, is_main, is_active')
    .is('deleted_at', null)
    .order('is_main', { ascending: false })
    .order('name');

  if (error) throw error;
  return data ?? [];
}
