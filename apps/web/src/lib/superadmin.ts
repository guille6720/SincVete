import { parseSuperadminEmails } from '@sincvete/shared';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Env allowlist users must exist in platform_admins before SECURITY DEFINER RPCs succeed.
 * Called only after requireSuperadmin() confirmed the session flag.
 */
export async function ensurePlatformAdminRegistration(userId: string, email: string | null) {
  const normalized = email?.trim().toLowerCase() ?? '';
  const allow = parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);
  if (normalized && allow.includes(normalized)) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (Production). Sin esa clave no se puede registrar Superadmin en la base.'
      );
    }
    const service = await createServiceClient();
    const { error } = await service.from('platform_admins').upsert({
      user_id: userId,
      email: normalized,
      is_active: true,
      notes: 'bootstrap from SUPERADMIN_EMAILS',
    });
    if (error) {
      throw new Error(
        `No se pudo registrar Superadmin en la base: ${error.message}. Aplicá las migraciones de entitlements en Supabase.`
      );
    }
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error || data !== true) {
    throw new Error(
      error?.message
        ? `No hay acceso Superadmin en la base: ${error.message}. Aplicá las migraciones y recargá.`
        : 'No tenés acceso de Superadmin. El email tiene que estar en SUPERADMIN_EMAILS o en platform_admins.'
    );
  }
}
