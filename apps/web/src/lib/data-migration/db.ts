import 'server-only';

import { createServerClient } from '@/lib/supabase/server';

/**
 * Temporary until generated Database types include data_migration tables.
 * Single escape hatch for PostgREST chaining — do not spread `any` elsewhere.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pending Database codegen for migration tables
export type MigrationDb = { from: (table: string) => any };

export async function migrationDb(): Promise<MigrationDb> {
  return (await createServerClient()) as unknown as MigrationDb;
}
