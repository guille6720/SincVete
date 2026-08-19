'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LEGAL_DOCS, LEGAL_VERSION, getLegalDoc } from '@/lib/legal/catalog';

export function SettingsLegalPanel() {
  const [slug, setSlug] = useState<string | null>(null);
  const doc = slug ? getLegalDoc(slug) : null;

  if (doc) {
    return (
      <Card>
        <CardHeader>
          <Button type="button" variant="ghost" className="mb-2 w-fit gap-2 px-0" onClick={() => setSlug(null)}>
            <ArrowLeft className="h-4 w-4" />
            Volver a Legal
          </Button>
          <CardTitle>{doc.title}</CardTitle>
          <CardDescription>
            Versión {LEGAL_VERSION} · {doc.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal</CardTitle>
        <CardDescription>
          Términos, privacidad, seguridad y demás políticas de SyncVete. Versión {LEGAL_VERSION}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {LEGAL_DOCS.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => setSlug(item.slug)}
            className="rounded-lg border p-4 text-left transition hover:bg-accent"
          >
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
