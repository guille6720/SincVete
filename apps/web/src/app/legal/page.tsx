import Link from 'next/link';
import type { Metadata } from 'next';
import { LEGAL_DOCS, LEGAL_VERSION } from '@/lib/legal/catalog';
import { APP_NAME } from '@sincvete/shared';

export const metadata: Metadata = {
  title: `Legal · ${APP_NAME}`,
  description: 'Términos, privacidad, seguridad y demás políticas de SyncVete.',
};

export default function LegalIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Versión {LEGAL_VERSION}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Documentos legales</h1>
      <p className="mt-3 text-muted-foreground">
        Políticas de SyncVete para clínicas veterinarias en Argentina. Al registrarte aceptás los
        Términos del Servicio y la Política de Privacidad.
      </p>
      <ul className="mt-10 divide-y rounded-2xl border">
        {LEGAL_DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/legal/${doc.slug}`} className="block px-5 py-4 transition hover:bg-muted/50">
              <p className="font-medium">{doc.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
