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
    await supabase.auth.signOut();
  }

  redirect('/login');
}
