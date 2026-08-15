import { redirect } from 'next/navigation';
import { getSessionContext } from '@/actions/auth';
import { createServerClient } from '@/lib/supabase/server';

export default async function HomeRouterPage() {
  const session = await getSessionContext();

  if (session?.kind === 'portal') {
    redirect('/portal');
  }

  if (session?.kind === 'staff') {
    redirect('/dashboard');
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Auth ok but no clinic profile yet — send back to login with a clear reason
    // instead of signing out silently (looks like "can't enter").
    await supabase.auth.signOut();
    redirect('/login?error=incomplete_account');
  }

  redirect('/login');
}
