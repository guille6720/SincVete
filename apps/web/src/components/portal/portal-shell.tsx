'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@sincvete/shared';

interface PortalShellProps {
  children: React.ReactNode;
  userName: string;
  signOutAction: () => Promise<void>;
}

export function PortalShell({ children, userName, signOutAction }: PortalShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/portal" className="flex items-center gap-2 font-semibold text-primary">
            <PawPrint className="h-5 w-5" />
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/portal"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm',
                pathname === '/portal'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              Inicio
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
