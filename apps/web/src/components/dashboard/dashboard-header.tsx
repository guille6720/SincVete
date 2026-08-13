import { ROLE_LABELS, type DashboardContext, type SessionContext } from '@sincvete/shared';
import { Building2, PawPrint, Stethoscope } from 'lucide-react';

interface DashboardHeaderProps {
  session: SessionContext;
  context: DashboardContext | null;
}

export function DashboardHeader({ session, context }: DashboardHeaderProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <section className="relative overflow-hidden rounded-2xl border border-teal-800/10 shadow-sm">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/dashboard/clinic-hero.jpg')" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,47,42,0.88)_0%,rgba(15,118,110,0.72)_48%,rgba(12,47,42,0.55)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "url('/dashboard/paw-pattern.svg')",
          backgroundSize: '140px 140px',
        }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-5 p-6 text-white md:flex-row md:items-end md:justify-between md:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <PawPrint className="h-3.5 w-3.5 text-emerald-200" />
            Panel de la clínica
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {greeting}, {session.profile.full_name.split(' ')[0]}
            </h1>
            <p className="max-w-xl text-sm text-teal-50/90 md:text-base">
              Rol: {session.role ? ROLE_LABELS[session.role] : 'Portal'}. Resumen del día y accesos
              rápidos a la operación.
            </p>
          </div>
          {context && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs backdrop-blur-sm">
                <Building2 className="h-3.5 w-3.5 text-emerald-200" />
                {context.organizationName}
              </span>
              {context.branchName && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs backdrop-blur-sm">
                  <Stethoscope className="h-3.5 w-3.5 text-emerald-200" />
                  Sucursal {context.branchName}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/20 ring-1 ring-white/25 backdrop-blur-sm">
            <Stethoscope className="h-7 w-7 text-emerald-100" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-300/20 ring-1 ring-white/25 backdrop-blur-sm">
            <PawPrint className="h-7 w-7 text-sky-100" />
          </div>
        </div>
      </div>
    </section>
  );
}
