import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

export function createBrowserClient(
  url: string,
  anonKey: string
): TypedSupabaseClient {
  return createClient<Database>(url, anonKey);
}

export function createServerClient(
  url: string,
  key: string
): TypedSupabaseClient {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceClient(
  url: string,
  serviceRoleKey: string
): TypedSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export * from './types/database';
