import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { BrandLogo } from '@/components/brand/syncvete-logo';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  if (!session.isPlatformAdmin) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <BrandLogo href="/superadmin" size="sm" />
          <span className="text-sm font-medium text-muted-foreground">Superadmin</span>
          <nav className="ml-4 flex items-center gap-3 text-sm">
            <Link href="/superadmin" className="hover:text-primary">
              Organizaciones
            </Link>
          </nav>
          <Link href="/dashboard" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            Volver a la clínica
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
