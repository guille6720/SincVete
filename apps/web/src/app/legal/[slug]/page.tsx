import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LEGAL_DOCS, getLegalDoc } from '@/lib/legal/catalog';
import { APP_NAME } from '@sincvete/shared';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return { title: `Legal · ${APP_NAME}` };
  return {
    title: `${doc.title} · ${APP_NAME}`,
    description: doc.summary,
  };
}

export default async function LegalDocPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/legal" className="hover:text-foreground">
          Legal
        </Link>
        {' / '}
        {doc.title}
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-muted-foreground">{doc.summary}</p>
      <article className="mt-10 space-y-5 text-sm leading-relaxed text-foreground/90">
        {doc.blocks.map((block, index) =>
          block.type === 'p' ? (
            <p key={index}>{block.text}</p>
          ) : (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        )}
      </article>
    </main>
  );
}
