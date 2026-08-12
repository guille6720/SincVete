import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Calendar,
  FlaskConical,
  LayoutDashboard,
  Package,
  PawPrint,
  Bell,
  Receipt,
  Scissors,
  Syringe,
  TrendingUp,
  Users,
  Pill,
  Banknote,
  Images,
  Inbox,
  ScrollText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMonthLabel, type DashboardSummary } from '@sincvete/shared';

interface DashboardStatCardsProps {
  summary: DashboardSummary;
}

export function DashboardStatCards({ summary }: DashboardStatCardsProps) {
  const monthLabel = getCurrentMonthLabel();

  const stats: Array<{
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    href?: string;
  }> = [
    {
      label: 'Pacientes activos',
      value: String(summary.activePatients),
      description: 'Sin fallecer ni inactivos',
      icon: PawPrint,
      href: '/pacientes',
    },
    {
      label: 'Propietarios activos',
      value: String(summary.activeOwners),
      description: 'Tutores registrados',
      icon: Users,
      href: '/propietarios',
    },
    {
      label: 'Altas del mes',
      value: String(summary.patientsThisMonth + summary.ownersThisMonth),
      description: `${summary.patientsThisMonth} pacientes · ${summary.ownersThisMonth} propietarios · ${monthLabel}`,
      icon: TrendingUp,
    },
    {
      label: 'Citas hoy',
      value: String(summary.appointmentsToday),
      description: 'Programadas para hoy',
      icon: Calendar,
      href: '/agenda',
    },
    {
      label: 'Consultas del mes',
      value: String(summary.consultationsThisMonth),
      description: `Completadas · ${monthLabel}`,
      icon: LayoutDashboard,
      href: '/consultas',
    },
    {
      label: 'Internados',
      value: String(summary.hospitalizationsActive),
      description: 'Internación u observación',
      icon: BedDouble,
      href: '/internacion',
    },
    {
      label: 'Vacunas vencidas',
      value: String(summary.vaccinationsOverdue),
      description: 'Última dosis por vacuna',
      icon: Syringe,
      href: '/vacunacion',
    },
    {
      label: 'En quirófano',
      value: String(summary.surgeriesActive),
      description: 'En curso o recuperación',
      icon: Scissors,
      href: '/cirugias',
    },
    {
      label: 'Lab pendientes',
      value: String(summary.labOrdersPending),
      description: 'Solicitadas o en proceso',
      icon: FlaskConical,
      href: '/laboratorio',
    },
    {
      label: 'Stock bajo',
      value: String(summary.inventoryLowStock),
      description: 'En o bajo el mínimo',
      icon: Package,
      href: '/inventario',
    },
    {
      label: 'Recetas activas',
      value: String(summary.prescriptionsActive),
      description: 'Pendientes de dispensar',
      icon: Pill,
      href: '/farmacia',
    },
    {
      label: 'Por cobrar',
      value: String(summary.invoicesOpen),
      description: 'Facturas emitidas con saldo',
      icon: Receipt,
      href: '/facturacion',
    },
    {
      label: 'Caja abierta',
      value: String(summary.cashSessionsOpen),
      description: 'Turnos de caja sin cerrar',
      icon: Banknote,
      href: '/caja',
    },
    {
      label: 'Imágenes del mes',
      value: String(summary.clinicalImagesThisMonth),
      description: `Subidas · ${monthLabel}`,
      icon: Images,
      href: '/imagenes',
    },
    {
      label: 'Sin leer',
      value: String(summary.notificationsUnread),
      description: 'Avisos de la clínica',
      icon: Inbox,
      href: '/notificaciones',
    },
    {
      label: 'Auditoría hoy',
      value: String(summary.auditEventsToday),
      description: 'Eventos registrados',
      icon: ScrollText,
      href: '/auditoria',
    },
    {
      label: 'Recordatorios',
      value: String(summary.remindersPending),
      description: 'Turnos, vacunas y saldos por avisar',
      icon: Bell,
      href: '/recordatorios',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {stats.map((stat) => {
        const content = (
          <Card className={stat.href ? 'transition-colors hover:border-primary/40' : undefined}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription>{stat.description}</CardDescription>
            </CardContent>
          </Card>
        );

        return stat.href ? (
          <Link key={stat.label} href={stat.href} className="block">
            {content}
          </Link>
        ) : (
          <div key={stat.label}>{content}</div>
        );
      })}
    </div>
  );
}
