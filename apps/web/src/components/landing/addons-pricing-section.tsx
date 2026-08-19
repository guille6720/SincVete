import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FALLBACK_PUBLIC_ADDONS,
  formatArsAmount,
  type PublicAddonCatalogItem,
} from '@sincvete/shared';

export function AddonsPricingSection({
  addons = FALLBACK_PUBLIC_ADDONS,
}: {
  addons?: PublicAddonCatalogItem[];
}) {
  if (addons.length === 0) return null;

  return (
    <section id="extras" className="scroll-mt-24 border-t border-[var(--land-line)] bg-white py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-[var(--land-accent)]">Extras</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--land-ink)] md:text-4xl">
            Sumá módulos sin cambiar de plan
          </h2>
          <p className="mt-4 text-[var(--land-muted)]">
            IA, WhatsApp, portal, imágenes o reportes sobre Basic o Pro. Se compran desde Configuración
            después de registrar la clínica. Premium ya los incluye.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {addons.map((addon) => {
            const monthly = formatArsAmount(addon.pricing.monthlyAmount);
            return (
              <div key={addon.key} className="flex flex-col border border-[var(--land-line)] p-6">
                <h3 className="font-display text-xl font-semibold text-[var(--land-ink)]">{addon.name}</h3>
                {addon.description ? (
                  <p className="mt-1 text-sm text-[var(--land-muted)]">{addon.description}</p>
                ) : null}
                <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-[var(--land-ink)]">
                  {monthly ? `$ ${monthly}` : 'Consultar'}
                  {monthly ? (
                    <span className="text-base font-sans font-normal text-[var(--land-muted)]"> / mes</span>
                  ) : null}
                </p>
                {addon.pricing.annualAmount ? (
                  <p className="mt-1 text-xs text-[var(--land-muted)]">
                    Anual $ {formatArsAmount(addon.pricing.annualAmount)} · 2 meses bonificados
                  </p>
                ) : null}
                <ul className="mt-4 flex-1 space-y-2">
                  {addon.pricing.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm leading-snug text-[var(--land-ink)]/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--land-accent)]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="mt-6 h-11 w-full rounded-none bg-[var(--land-accent)] text-base font-semibold text-white hover:bg-[var(--land-ink)]"
                  asChild
                >
                  <Link href="/register">Empezar trial</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
