import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from '@sincvete/db';

/** One Supabase server client per request (cookies are request-scoped). */
export const createServerClient = cache(async () => {
  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — middleware handles refresh
          }
        },
      },
    }
  );
});

export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (o la URL de Supabase) en Vercel. Superadmin la usa para registrarte en platform_admins.'
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
