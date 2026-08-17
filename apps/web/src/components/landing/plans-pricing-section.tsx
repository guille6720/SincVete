import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TRIAL_DAYS = 10;

const PLANS = [
  {
    id: 'esencial',
    name: 'Esencial',
    tagline: 'Para consultorios que están arrancando',
    price: '29.990',
    annual: '299.900',
    seats: 'Hasta 3 profesionales',
    recommended: false,
    highlights: [
      'Agenda, pacientes e historia clínica',
      'Vacunación y portal del tutor',
      'Recordatorios por WhatsApp',
      'Hasta 3 usuarios del equipo',
      'Soporte por email',
    ],
  },
  {
    id: 'clinica',
    name: 'Clínica',
    tagline: 'La operación completa de tu clínica',
    price: '39.900',
    annual: '399.000',
    seats: 'Hasta 10 profesionales',
    recommended: true,
    highlights: [
      'Todo Esencial + farmacia e inventario',
      'Facturación, caja y reportes',
      'Laboratorio, internación y cirugías',
      'IA clínica y multi-sucursal',
      'Roles y permisos por miembro',
      'Hasta 10 usuarios del equipo',
    ],
  },
] as const;

export function PlansPricingSection() {
  return (
    <section id="planes" className="scroll-mt-24 border-t border-[var(--land-line)] bg-[var(--land-surface)] py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-[var(--land-accent)]">Planes</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--land-ink)] md:text-4xl">
            Suscribite y operá hoy
          </h2>
          <p className="mt-4 text-[var(--land-muted)]">
            Precios en pesos argentinos. {TRIAL_DAYS} días gratis al crear tu clínica — sin tarjeta.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col border p-7 md:p-8',
                plan.recommended
                  ? 'border-[var(--land-accent)] bg-[var(--land-ink)] text-white'
                  : 'border-[var(--land-line)] bg-white text-[var(--land-ink)]'
              )}
            >
              {plan.recommended ? (
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--land-mint)]">
                  Más elegido
                </p>
              ) : (
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--land-muted)]">
                  Ideal para empezar
                </p>
              )}

              <h3 className="font-display text-2xl font-semibold">{plan.name}</h3>
              <p
                className={cn(
                  'mt-1 text-sm',
                  plan.recommended ? 'text-white/70' : 'text-[var(--land-muted)]'
                )}
              >
                {plan.tagline}
              </p>

              <p className="mt-6 font-display text-4xl font-semibold tracking-tight">
                $ {plan.price}
                <span
                  className={cn(
                    'text-base font-sans font-normal',
                    plan.recommended ? 'text-white/55' : 'text-[var(--land-muted)]'
                  )}
                >
                  {' '}
                  / mes
                </span>
              </p>
              <p
                className={cn(
                  'mt-1 text-xs',
                  plan.recommended ? 'text-white/50' : 'text-[var(--land-muted)]'
                )}
              >
                Anual $ {plan.annual} · 2 meses bonificados
              </p>
              <p
                className={cn(
                  'mt-4 text-sm font-medium',
                  plan.recommended ? 'text-[var(--land-mint)]' : 'text-[var(--land-accent)]'
                )}
              >
                {plan.seats}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-sm leading-snug">
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        plan.recommended ? 'text-[var(--land-mint)]' : 'text-[var(--land-accent)]'
                      )}
                    />
                    <span className={plan.recommended ? 'text-white/85' : 'text-[var(--land-ink)]/80'}>
                      {h}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className={cn(
                  'mt-8 h-12 w-full rounded-none text-base font-semibold',
                  plan.recommended
                    ? 'bg-[var(--land-mint)] text-[var(--land-ink)] hover:bg-white'
                    : 'bg-[var(--land-accent)] text-white hover:bg-[var(--land-ink)]'
                )}
                asChild
              >
                <Link href="/register">Empezar {TRIAL_DAYS} días gratis</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[var(--land-muted)]">
          ¿Más de 10 profesionales?{' '}
          <Link href="/register" className="font-medium text-[var(--land-accent)] underline-offset-4 hover:underline">
            Escribinos al registrarte
          </Link>{' '}
          y te armamos el plan.
        </p>
      </div>
    </section>
  );
}
