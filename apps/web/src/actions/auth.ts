'use server';

import { redirect } from 'next/navigation';
import {
  signInSchema,
  signUpSchema,
  type ActionResult,
  type SessionContext,
} from '@sincvete/shared';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { getSessionContext as loadSessionContext } from '@/lib/session';

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

export async function getSessionContext(): Promise<SessionContext | null> {
  return loadSessionContext();
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
