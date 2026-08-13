import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  Calendar,
  FlaskConical,
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
  Stethoscope,
} from 'lucide-react';
import { getCurrentMonthLabel, type DashboardSummary } from '@sincvete/shared';
import { cn } from '@/lib/utils';

interface DashboardStatCardsProps {
  summary: DashboardSummary;
}

type StatTone = 'teal' | 'sky' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'slate' | 'indigo' | 'lime';

const TONE_STYLES: Record<
  StatTone,
  { card: string; iconWrap: string; icon: string; value: string }
> = {
  teal: {
    card: 'border-teal-200/80 bg-gradient-to-br from-teal-50 to-white hover:border-teal-300',
    iconWrap: 'bg-teal-100 text-teal-700',
    icon: 'text-teal-700',
    value: 'text-teal-950',
  },
  sky: {
    card: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white hover:border-sky-300',
    iconWrap: 'bg-sky-100 text-sky-700',
    icon: 'text-sky-700',
    value: 'text-sky-950',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-700',
    value: 'text-emerald-950',
  },
  amber: {
    card: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300',
    iconWrap: 'bg-amber-100 text-amber-700',
    icon: 'text-amber-700',
    value: 'text-amber-950',
  },
  rose: {
    card: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white hover:border-rose-300',
    iconWrap: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-700',
    value: 'text-rose-950',
  },
  cyan: {
    card: 'border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-white hover:border-cyan-300',
    iconWrap: 'bg-cyan-100 text-cyan-700',
    icon: 'text-cyan-700',
    value: 'text-cyan-950',
  },
  orange: {
    card: 'border-orange-200/80 bg-gradient-to-br from-orange-50 to-white hover:border-orange-300',
    iconWrap: 'bg-orange-100 text-orange-700',
    icon: 'text-orange-700',
    value: 'text-orange-950',
  },
  slate: {
    card: 'border-slate-200/80 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300',
    iconWrap: 'bg-slate-100 text-slate-700',
    icon: 'text-slate-700',
    value: 'text-slate-950',
  },
  indigo: {
    card: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300',
    iconWrap: 'bg-indigo-100 text-indigo-700',
    icon: 'text-indigo-700',
    value: 'text-indigo-950',
  },
  lime: {
    card: 'border-lime-200/80 bg-gradient-to-br from-lime-50 to-white hover:border-lime-300',
    iconWrap: 'bg-lime-100 text-lime-700',
    icon: 'text-lime-700',
    value: 'text-lime-950',
  },
};

export function DashboardStatCards({ summary }: DashboardStatCardsProps) {
  const monthLabel = getCurrentMonthLabel();

  const stats: Array<{
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    href?: string;
    tone: StatTone;
  }> = [
    {
      label: 'Pacientes activos',
      value: String(summary.activePatients),
      description: 'Sin fallecer ni inactivos',
      icon: PawPrint,
      href: '/pacientes',
      tone: 'teal',
    },
    {
      label: 'Propietarios activos',
      value: String(summary.activeOwners),
      description: 'Tutores registrados',
      icon: Users,
      href: '/propietarios',
      tone: 'sky',
    },
    {
      label: 'Altas del mes',
      value: String(summary.patientsThisMonth + summary.ownersThisMonth),
      description: `${summary.patientsThisMonth} pacientes · ${summary.ownersThisMonth} propietarios · ${monthLabel}`,
      icon: TrendingUp,
      tone: 'emerald',
    },
    {
      label: 'Citas hoy',
      value: String(summary.appointmentsToday),
      description: 'Programadas para hoy',
      icon: Calendar,
      href: '/agenda',
      tone: 'indigo',
    },
    {
      label: 'Consultas del mes',
      value: String(summary.consultationsThisMonth),
      description: `Completadas · ${monthLabel}`,
      icon: Stethoscope,
      href: '/consultas',
      tone: 'cyan',
    },
    {
      label: 'Internados',
      value: String(summary.hospitalizationsActive),
      description: 'Internación u observación',
      icon: BedDouble,
      href: '/internacion',
      tone: 'rose',
    },
    {
      label: 'Vacunas vencidas',
      value: String(summary.vaccinationsOverdue),
      description: 'Última dosis por vacuna',
      icon: Syringe,
      href: '/vacunacion',
      tone: 'amber',
    },
    {
      label: 'En quirófano',
      value: String(summary.surgeriesActive),
      description: 'En curso o recuperación',
      icon: Scissors,
      href: '/cirugias',
      tone: 'orange',
    },
    {
      label: 'Lab pendientes',
      value: String(summary.labOrdersPending),
      description: 'Solicitadas o en proceso',
      icon: FlaskConical,
      href: '/laboratorio',
      tone: 'lime',
    },
    {
      label: 'Stock bajo',
      value: String(summary.inventoryLowStock),
      description: 'En o bajo el mínimo',
      icon: Package,
      href: '/inventario',
      tone: 'amber',
    },
    {
      label: 'Recetas activas',
      value: String(summary.prescriptionsActive),
      description: 'Pendientes de dispensar',
      icon: Pill,
      href: '/farmacia',
      tone: 'sky',
    },
    {
      label: 'Por cobrar',
      value: String(summary.invoicesOpen),
      description: 'Facturas emitidas con saldo',
      icon: Receipt,
      href: '/facturacion',
      tone: 'emerald',
    },
    {
      label: 'Caja abierta',
      value: String(summary.cashSessionsOpen),
      description: 'Turnos de caja sin cerrar',
      icon: Banknote,
      href: '/caja',
      tone: 'teal',
    },
    {
      label: 'Imágenes del mes',
      value: String(summary.clinicalImagesThisMonth),
      description: `Subidas · ${monthLabel}`,
      icon: Images,
      href: '/imagenes',
      tone: 'indigo',
    },
    {
      label: 'Sin leer',
      value: String(summary.notificationsUnread),
      description: 'Avisos de la clínica',
      icon: Inbox,
      href: '/notificaciones',
      tone: 'rose',
    },
    {
      label: 'Auditoría hoy',
      value: String(summary.auditEventsToday),
      description: 'Eventos registrados',
      icon: ScrollText,
      href: '/auditoria',
      tone: 'slate',
    },
    {
      label: 'Recordatorios',
      value: String(summary.remindersPending),
      description: 'Turnos, vacunas y saldos por avisar',
      icon: Bell,
      href: '/recordatorios',
      tone: 'orange',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {stats.map((stat) => {
        const tone = TONE_STYLES[stat.tone];
        const content = (
          <div
            className={cn(
              'group h-full rounded-xl border p-4 shadow-sm transition-all duration-200',
              tone.card,
              stat.href && 'hover:-translate-y-0.5 hover:shadow-md'
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">{stat.label}</p>
              <span
                className={cn(
                  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  tone.iconWrap
                )}
              >
                <stat.icon className={cn('h-5 w-5', tone.icon)} />
              </span>
            </div>
            <div className={cn('text-3xl font-bold tracking-tight', tone.value)}>{stat.value}</div>
            <p className="mt-1 text-xs text-slate-500">{stat.description}</p>
          </div>
        );

        return stat.href ? (
          <Link key={stat.label} href={stat.href} className="block h-full">
            {content}
          </Link>
        ) : (
          <div key={stat.label} className="h-full">
            {content}
          </div>
        );
      })}
    </div>
  );
}
