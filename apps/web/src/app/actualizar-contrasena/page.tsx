import { createServerClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default async function ActualizarContrasenaPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <ResetPasswordForm hasSession={Boolean(user)} />
    </div>
  );
}
