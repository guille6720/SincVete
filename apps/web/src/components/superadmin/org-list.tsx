'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { PaginatedResult } from '@sincvete/shared';
import type { SuperadminOrgListRow } from '@/actions/superadmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function statusVariant(status: SuperadminOrgListRow['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'trialing') return 'warning' as const;
  if (status === 'cancelled' || status === 'expired' || status === 'past_due') {
    return 'destructive' as const;
  }
  return 'default' as const;
}

export function SuperadminOrgList({
  data,
  initialSearch,
}: {
  data: PaginatedResult<SuperadminOrgListRow>;
  initialSearch: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [pending, startTransition] = useTransition();

  function applySearch(page = 1) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (page > 1) params.set('page', String(page));
    startTransition(() => {
      router.push(params.size ? `/superadmin?${params.toString()}` : '/superadmin');
    });
  }

  return (
    <div className={`space-y-4 ${pending ? 'opacity-70' : ''}`}>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(1);
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o slug"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Clínica</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Trial hasta</th>
              <th className="px-3 py-2 font-medium">Alta</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={5}>
                  No hay organizaciones todavía.
                </td>
              </tr>
            ) : (
              data.data.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/superadmin/organizaciones/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{row.slug}</div>
                  </td>
                  <td className="px-3 py-2">{row.planName ?? '—'}</td>
                  <td className="px-3 py-2">
                    {row.status ? (
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    ) : (
                      'sin suscripción'
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.trialEndsAt ? new Date(row.trialEndsAt).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {data.total} organizaciones · página {data.page} de {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={data.page <= 1}
              onClick={() => applySearch(data.page - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={data.page >= data.totalPages}
              onClick={() => applySearch(data.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
