'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BedDouble,
  BarChart3,
  Calendar,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PawPrint,
  Receipt,
  Scissors,
  Settings,
  Stethoscope,
  Syringe,
  Users,
  X,
  Bell,
  Sparkles,
  MessageCircle,
  Pill,
  Banknote,
  Images,
  Inbox,
  ScrollText,
} from 'lucide-react';
import { useState } from 'react';
import { signOut } from '@/actions/auth';
import { BranchSelector } from '@/components/layout/branch-selector';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type Role } from '@sincvete/shared';
import { BrandLogo } from '@/components/brand/sincvete-logo';
import { ThemeControls } from '@/components/theme/theme-controls';
import { AppUpdateBanner } from '@/components/layout/app-update-banner';
import { CommandPalette, CommandPaletteTrigger } from './command-palette';
import { NotificationBell } from '@/components/notifications/notification-bell';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Pacientes', href: '/pacientes', icon: PawPrint },
  { label: 'Propietarios', href: '/propietarios', icon: Users },
  { label: 'Historia clínica', href: '/historia-clinica', icon: ClipboardList },
  { label: 'Imágenes', href: '/imagenes', icon: Images },
  { label: 'Consultas', href: '/consultas', icon: Stethoscope },
  { label: 'Internación', href: '/internacion', icon: BedDouble },
  { label: 'Vacunación', href: '/vacunacion', icon: Syringe },
  { label: 'Cirugías', href: '/cirugias', icon: Scissors },
  { label: 'Laboratorio', href: '/laboratorio', icon: FlaskConical },
  { label: 'Inventario', href: '/inventario', icon: Package },
  { label: 'Farmacia', href: '/farmacia', icon: Pill },
  { label: 'Facturación', href: '/facturacion', icon: Receipt },
  { label: 'Caja', href: '/caja', icon: Banknote },
  { label: 'Reportes', href: '/reportes', icon: BarChart3 },
  { label: 'Auditoría', href: '/auditoria', icon: ScrollText },
  { label: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { label: 'Recordatorios', href: '/recordatorios', icon: Bell },
  { label: 'Notificaciones', href: '/notificaciones', icon: Inbox },
  { label: 'IA clínica', href: '/ia-clinica', icon: Sparkles },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
] as const;

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  role: Role;
  branchName?: string;
  branches?: Array<{ id: string; name: string; is_active: boolean }>;
  activeBranchId?: string | null;
  unreadNotifications?: number;
}

export function AppShell({
  children,
  userName,
  role,
  branchName,
  branches = [],
  activeBranchId,
  unreadNotifications = 0,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--shell-bg)' }}>
      <AppUpdateBanner />
      <CommandPalette />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r shadow-sm backdrop-blur transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          borderColor: 'var(--shell-border)',
          backgroundColor: 'var(--shell-surface)',
        }}
      >
        <div
          className="relative border-b px-3 pb-2 pt-3"
          style={{
            borderColor: 'var(--shell-border)',
            backgroundColor: 'var(--shell-surface)',
          }}
        >
          <Link
            href="/dashboard"
            className="block w-full"
            aria-label="SincVete"
          >
            <span className="block dark:hidden">
              <BrandLogo size="sidebar" variant="onLight" priority className="mx-auto object-contain object-center" />
            </span>
            <span className="hidden dark:block">
              <BrandLogo size="sidebar" variant="onDark" priority className="mx-auto object-contain object-center" />
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {branchName && (
          <div
            className="border-b px-4 py-3"
            style={{
              borderColor: 'var(--shell-border)',
              backgroundColor: 'var(--shell-panel)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--clinic)' }}>
              Sucursal
            </p>
            {branches.length > 1 ? (
              <BranchSelector branches={branches} activeBranchId={activeBranchId ?? null} />
            ) : (
              <p className="truncate text-sm font-medium">{branchName}</p>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--clinic)] text-white shadow-sm shadow-[color-mix(in_oklab,var(--clinic)_25%,transparent)]'
                    : 'text-[var(--shell-text)] hover:bg-[var(--clinic-soft)] hover:text-[var(--clinic)]'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-md',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--clinic-soft)] text-[var(--clinic)]'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3" style={{ borderColor: 'var(--shell-border)' }}>
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
          <form action={signOut}>
            <Button variant="ghost" className="w-full justify-start gap-2" type="submit">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:gap-4"
          style={{
            borderColor: 'var(--shell-border)',
            backgroundColor: 'var(--shell-header)',
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <CommandPaletteTrigger />
          <ThemeControls />
          <div className="ml-auto flex items-center gap-2">
            {branches.length > 1 && (
              <div className="hidden md:block">
                <BranchSelector branches={branches} activeBranchId={activeBranchId ?? null} />
              </div>
            )}
            <NotificationBell unreadCount={unreadNotifications} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
