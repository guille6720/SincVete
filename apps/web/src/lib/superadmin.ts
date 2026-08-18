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
    const service = await createServiceClient();
    const { error } = await service.from('platform_admins').upsert({
      user_id: userId,
      email: normalized,
      is_active: true,
      notes: 'bootstrap from SUPERADMIN_EMAILS',
    });
    if (error) {
      throw new Error('No se pudo registrar Superadmin en la base');
    }
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error || data !== true) {
    throw new Error('No tenés acceso de Superadmin');
  }
}
