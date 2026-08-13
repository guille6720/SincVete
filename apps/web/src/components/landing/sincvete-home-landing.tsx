import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@sincvete/shared';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/sincvete-logo';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { PlansPricingSection } from '@/components/landing/plans-pricing-section';
import { MarketingHeroVisual, LandingPhotoStrip, LandingClinicScene, LandingCtaBackdrop } from '@/components/landing/marketing-ui-mocks';

const REASONS = [
  {
    title: 'Una sola plataforma',
    body: 'Agenda, historia clínica, farmacia, caja y portal del tutor. Sin saltar entre Excel, WhatsApp y carpetas.',
  },
  {
    title: 'Hecho para Argentina',
    body: 'Pesos, flujos de mostrador reales y recordatorios a tutores por WhatsApp. Pensado para tu clínica, no para un hospital de EE.UU.',
  },
  {
    title: 'IA que acelera, no decide',
    body: 'Resúmenes y borradores SOAP antes de la consulta. Vos firmás. El criterio clínico sigue siendo tuyo.',
  },
] as const;

const MODULES = [
  {
    title: 'Agenda y pacientes',
    body: 'Turnos por profesional, estados claros y fichas de mascota + tutor siempre a mano.',
  },
  {
    title: 'Historia clínica',
    body: 'SOAP, vacunas, laboratorio, internación y cirugías en una línea de tiempo única.',
  },
  {
    title: 'Farmacia y stock',
    body: 'Recetas que descuentan inventario. Alertas de stock bajo. Trazabilidad completa.',
  },
  {
    title: 'Caja y facturación',
    body: 'Emití, cobrá y cerrá caja por sucursal. Reportes para saber cómo va el mes.',
  },
  {
    title: 'Portal del tutor',
    body: 'Tus clientes ven citas y vacunas sin pedirte captura de pantalla por WhatsApp.',
  },
  {
    title: 'Equipo y seguridad',
    body: 'Roles, permisos, multi-sucursal y auditoría. Cada clínica aislada con RLS.',
  },
] as const;

const FAQ = [
  {
    q: '¿Puedo probar antes de suscribirme?',
    a: 'Sí. Al registrarte tenés 10 días gratis con la clínica completa. Sin tarjeta.',
  },
  {
    q: '¿Qué incluye el plan Clínica?',
    a: 'Hasta 10 profesionales, farmacia, inventario, facturación, caja, laboratorio, internación, cirugías, IA clínica y multi-sucursal.',
  },
  {
    q: '¿Los tutores ven datos de otros pacientes?',
    a: 'No. El portal solo muestra las mascotas vinculadas a ese tutor.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: `${APP_NAME} usa Supabase con Row Level Security por organización. Auditoría de cambios para dueños y administradores.`,
  },
] as const;

export function SincVeteHomeLanding() {
  return (
    <div className="landing-root min-h-screen bg-[var(--land-bg)] text-[var(--land-ink)]">
      <MarketingHeader />

      {/* HERO — brand first, one CTA group, one dominant visual */}
      <section className="relative pt-16">
        <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-2">
          <div className="flex flex-col justify-center px-4 py-14 sm:px-8 lg:px-12 xl:pl-[max(3rem,calc((100vw-72rem)/2+1.5rem))]">
            <div className="animate-landing-rise">
              <BrandLogo size="hero" priority />
            </div>
            <h1 className="animate-landing-rise mt-5 max-w-lg font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--land-ink)] sm:text-4xl">
              La clínica veterinaria, en una sola app.
            </h1>
            <p className="animate-landing-rise mt-5 max-w-md text-base leading-relaxed text-[var(--land-muted)] sm:text-lg">
              Suscribite y operá agenda, historias, farmacia y caja sin fricción. Hecho para
              equipos en Argentina.
            </p>
            <div className="animate-landing-rise mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-12 rounded-none bg-[var(--land-accent)] px-7 text-base font-semibold text-white hover:bg-[var(--land-ink)]"
                asChild
              >
                <Link href="/register">
                  Empezar 10 días gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-none border-[var(--land-ink)]/20 bg-transparent px-6 text-base"
                asChild
              >
                <Link href="/#planes">Ver planes</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-[var(--land-muted)]">
              Desde $ 24.900 / mes · Cancelá cuando quieras
            </p>
          </div>

          <div className="animate-landing-fade relative min-h-[420px] lg:min-h-full">
            <MarketingHeroVisual />
          </div>
        </div>
      </section>

      <LandingPhotoStrip />

      {/* Why */}
      <section id="por-que" className="scroll-mt-24 border-t border-[var(--land-line)] py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-[var(--land-accent)]">
              Por qué SincVete
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Menos herramientas. Más clínica.
            </h2>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {REASONS.map((item, index) => (
              <div key={item.title} className="border-t border-[var(--land-line)] pt-6">
                <p className="font-mono text-xs text-[var(--land-accent)]">
                  0{index + 1}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--land-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product */}
      <section
        id="producto"
        className="scroll-mt-24 border-t border-[var(--land-line)] bg-[var(--land-surface)] py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium tracking-wide text-[var(--land-accent)]">
                Producto
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Todo el flujo del día, conectado.
              </h2>
              <p className="mt-4 max-w-xl text-[var(--land-muted)]">
                Del primer turno al cierre de caja. Diseñado para recepción, veterinarios y
                administración en el mismo sistema.
              </p>
            </div>
            <LandingClinicScene />
          </div>

          <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((mod) => (
              <div key={mod.title}>
                <h3 className="font-display text-lg font-semibold">{mod.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--land-muted)]">{mod.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <Button
              size="lg"
              className="h-12 rounded-none bg-[var(--land-accent)] px-7 text-base font-semibold text-white hover:bg-[var(--land-ink)]"
              asChild
            >
              <Link href="/register">
                Quiero suscribirme
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PlansPricingSection />

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-t border-[var(--land-line)] py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Preguntas frecuentes
          </h2>
          <div className="mt-12 space-y-0">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group border-b border-[var(--land-line)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-[var(--land-ink)]">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--land-muted)] transition group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-[var(--land-muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <LandingCtaBackdrop>
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mb-6 flex justify-center">
            <BrandLogo size="lg" variant="onDark" className="rounded-lg" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Empezá a operar con {APP_NAME} hoy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/75">
            Creá tu clínica en minutos. 10 días gratis. Después elegís Esencial o Clínica.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-12 rounded-none bg-[var(--land-mint)] px-8 text-base font-semibold text-[var(--land-ink)] hover:bg-white"
              asChild
            >
              <Link href="/register">
                Suscribirme ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-none border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10"
              asChild
            >
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </LandingCtaBackdrop>

      <MarketingFooter />
    </div>
  );
}
