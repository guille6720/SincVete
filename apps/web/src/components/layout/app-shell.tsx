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
import { APP_NAME, ROLE_LABELS, type Role } from '@sincvete/shared';
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
    <div className="flex min-h-screen bg-background">
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="font-semibold text-primary">
            {APP_NAME}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {branchName && (
          <div className="border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">Sucursal</p>
            {branches.length > 1 ? (
              <BranchSelector branches={branches} activeBranchId={activeBranchId ?? null} />
            ) : (
              <p className="truncate text-sm font-medium">{branchName}</p>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <CommandPaletteTrigger />
          {branches.length > 1 && (
            <div className="hidden md:block">
              <BranchSelector branches={branches} activeBranchId={activeBranchId ?? null} />
            </div>
          )}
          <div className="ml-auto">
            <NotificationBell unreadCount={unreadNotifications} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
