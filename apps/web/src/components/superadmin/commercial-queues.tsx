'use client';

import Link from 'next/link';
import { formatBillingEventLabel } from '@sincvete/shared';
import {
  cancelSuperadminCheckoutIntents,
  type SuperadminOpenCheckoutIntentRow,
  type SuperadminUnappliedBillingEvent,
} from '@/actions/superadmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePendingAction } from '@/lib/hooks/use-pending-action';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function orgLabel(name: string | null, slug: string | null) {
  if (name) return name;
  if (slug) return slug;
  return 'Sin clínica';
}

export function SuperadminCommercialQueues({
  checkoutIntents,
  pendingEvents,
}: {
  checkoutIntents: SuperadminOpenCheckoutIntentRow[];
  pendingEvents: SuperadminUnappliedBillingEvent[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, run] = usePendingAction();

  if (checkoutIntents.length === 0 && pendingEvents.length === 0) {
    return null;
  }

  async function release(organizationId: string) {
    setMessage(null);
    const form = new FormData();
    form.set('organizationId', organizationId);
    const result = await run(() => cancelSuperadminCheckoutIntents(form));
    if (!result) return;
    setMessage(result.success ? 'Pago en curso liberado' : result.error ?? 'No se pudo liberar');
    if (result.success) router.refresh();
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{message}</p> : null}

      {checkoutIntents.length > 0 ? (
        <Card id="pagos-en-curso">
          <CardHeader>
            <CardTitle className="text-lg">Pagos en curso</CardTitle>
            <CardDescription>
              Checkouts esperando el webhook. Liberá el aviso de la clínica si el cobro no va a
              completar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Clínica</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Clave</th>
                  <th className="py-2">Proveedor</th>
                  <th className="py-2">Vence</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {checkoutIntents.map((intent) => (
                  <tr key={intent.id} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/superadmin/organizaciones/${intent.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {intent.organizationName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{intent.organizationSlug}</div>
                    </td>
                    <td className="py-2">{intent.kind === 'addon' ? 'Extra' : 'Plan'}</td>
                    <td className="py-2">{intent.targetKey}</td>
                    <td className="py-2">{intent.provider}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(intent.expiresAt).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => void release(intent.organizationId)}
                      >
                        Liberar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {pendingEvents.length > 0 ? (
        <Card id="webhooks-pendientes">
          <CardHeader>
            <CardTitle className="text-lg">Webhooks pendientes</CardTitle>
            <CardDescription>
              Eventos de Mercado Pago / Stripe reclamados que todavía no se aplicaron. Un reembolso
              o cobro puede estar acá si el apply falló.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Clínica</th>
                  <th className="py-2">Evento</th>
                  <th className="py-2">Proveedor</th>
                  <th className="py-2">Cuando</th>
                </tr>
              </thead>
              <tbody>
                {pendingEvents.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="py-2">
                      {event.organizationId ? (
                        <>
                          <Link
                            href={`/superadmin/organizaciones/${event.organizationId}`}
                            className="font-medium hover:underline"
                          >
                            {orgLabel(event.organizationName, event.organizationSlug)}
                          </Link>
                          {event.organizationSlug ? (
                            <div className="text-xs text-muted-foreground">{event.organizationSlug}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin clínica</span>
                      )}
                    </td>
                    <td className="py-2">
                      {formatBillingEventLabel(event.eventType)}
                      <div className="text-xs text-muted-foreground">{event.eventType ?? event.eventId}</div>
                    </td>
                    <td className="py-2">
                      <Badge variant="warning">{event.provider}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(event.processedAt).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
