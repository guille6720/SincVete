import Link from 'next/link';
import { APP_NAME } from '@sincvete/shared';

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[var(--land-ink)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-2xl font-semibold">{APP_NAME}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            El sistema de gestión veterinaria para clínicas en Argentina. Agenda, historia
            clínica, farmacia, caja y portal del tutor en una sola plataforma.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              Producto
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <Link href="/#producto" className="hover:text-white">
                  Funciones
                </Link>
              </li>
              <li>
                <Link href="/#planes" className="hover:text-white">
                  Planes
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-white">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              Cuenta
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>
                <Link href="/register" className="hover:text-white">
                  Crear clínica
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white">
                  Iniciar sesión
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              Legal
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>Ley 25.326</li>
              <li>Multi-tenant con RLS</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados.
          </p>
          <p>Hecho para clínicas veterinarias de Argentina</p>
        </div>
      </div>
    </footer>
  );
}
