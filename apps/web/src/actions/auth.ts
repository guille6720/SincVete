'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  getPermissionsForRole,
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  type ActionResult,
  type SessionContext,
} from '@sincvete/shared';
import type { Permission, Role } from '@sincvete/shared';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

const CONNECTION_ERROR =
  'No se pudo conectar con la base de datos. Verificá que Supabase esté en marcha (Docker + `npx supabase start`) o que `.env.local` apunte a tu proyecto en la nube.';

function connectionErrorMessage(message: string | undefined): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  ) {
    return CONNECTION_ERROR;
  }
  return null;
}

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

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        success: false,
        error: connectionErrorMessage(error.message) ?? 'Email o contraseña incorrectos',
      };
    }

    const redirectTo = formData.get('redirectTo');
    if (typeof redirectTo === 'string' && redirectTo.startsWith('/portal/activar')) {
      redirect(redirectTo);
    }

    redirect('/home');
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      success: false,
      error:
        connectionErrorMessage(error instanceof Error ? error.message : String(error))
        ?? 'No se pudo iniciar sesión',
    };
  }
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

  if (formData.get('acceptTerms') !== 'on') {
    return {
      success: false,
      error: 'Tenés que aceptar los Términos del Servicio y la Política de Privacidad.',
    };
  }

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      return {
        success: false,
        error:
          connectionErrorMessage(authError.message)
          ?? (msg.includes('already') || msg.includes('registered')
            ? 'Este email ya está registrado. Probá iniciar sesión.'
            : authError.message),
      };
    }

    if (!authData.user) {
      return { success: false, error: 'No se pudo crear la cuenta. Probá con otro email.' };
    }

    // Supabase returns a user with empty identities when the email is already registered
    if (!authData.user.identities || authData.user.identities.length === 0) {
      return {
        success: false,
        error: 'Este email ya está registrado. Probá iniciar sesión.',
      };
    }

    const { error: setupError } = await supabase.rpc('handle_new_user_signup', {
      p_full_name: parsed.data.fullName,
      p_organization_name: parsed.data.organizationName,
      p_organization_slug: parsed.data.organizationSlug,
      p_branch_name: parsed.data.branchName,
    });

    if (setupError) {
      console.error('[signUp] handle_new_user_signup', setupError);
      try {
        const service = await createServiceClient();
        await service.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('[signUp] cleanup deleteUser failed', cleanupError);
      }

      const msg = setupError.message.toLowerCase();
      return {
        success: false,
        error: msg.includes('slug') || msg.includes('already taken')
          ? 'El identificador de clínica ya está en uso. Probá con otro (por ejemplo vete-bmw-2).'
          : setupError.message.includes('Could not find') || setupError.message.includes('schema cache')
            ? 'Falta aplicar las migraciones en Supabase (db push)'
            : msg.includes('jwt') || setupError.code === 'PGRST301' || msg.includes('not authenticated')
              ? 'Confirmá el email o desactivá "Confirm email" en Auth → Providers'
              : msg.includes('already has a profile')
                ? 'Este usuario ya tiene una clínica. Ingresá con tu email.'
                : `No se pudo configurar la clínica: ${setupError.message}`,
      };
    }

    redirect('/dashboard');
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      success: false,
      error:
        connectionErrorMessage(error instanceof Error ? error.message : String(error))
        ?? 'No se pudo crear la cuenta',
    };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

function getAppOrigin(headerStore: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;

  return 'http://localhost:3000';
}

export async function requestPasswordReset(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const supabase = await createServerClient();
    const headerStore = await headers();
    const origin = getAppOrigin(headerStore);
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/actualizar-contrasena')}`;

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });

    if (error) {
      return {
        success: false,
        error:
          connectionErrorMessage(error.message) ??
          'No se pudo enviar el email de recuperación. Intentá de nuevo.',
      };
    }

    // Always show success to avoid email enumeration
    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        connectionErrorMessage(error instanceof Error ? error.message : String(error)) ??
        'No se pudo enviar el email de recuperación',
    };
  }
}

export async function updatePassword(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'El enlace expiró o no es válido. Pedí uno nuevo desde recuperar contraseña.',
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return {
        success: false,
        error:
          connectionErrorMessage(error.message) ??
          'No se pudo actualizar la contraseña. Intentá de nuevo.',
      };
    }

    redirect('/home');
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      success: false,
      error:
        connectionErrorMessage(error instanceof Error ? error.message : String(error)) ??
        'No se pudo actualizar la contraseña',
    };
  }
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
