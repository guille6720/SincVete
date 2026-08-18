'use client';

import Link from 'next/link';
import { formatBillingEventLabel, formatMeteredUsage, quotaUsageLabel } from '@sincvete/shared';
import {
  cancelSuperadminCheckoutIntents,
  replaySuperadminBillingEvent,
  skipSuperadminBillingEvent,
  type SuperadminAddonEndingSoonRow,
  type SuperadminOpenCheckoutIntentRow,
  type SuperadminOrgOverSeatsRow,
  type SuperadminPlanEndingSoonRow,
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
  plansEndingSoon,
  addonsEndingSoon,
  orgsOverSeats,
}: {
  checkoutIntents: SuperadminOpenCheckoutIntentRow[];
  pendingEvents: SuperadminUnappliedBillingEvent[];
  plansEndingSoon: SuperadminPlanEndingSoonRow[];
  addonsEndingSoon: SuperadminAddonEndingSoonRow[];
  orgsOverSeats: SuperadminOrgOverSeatsRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, run] = usePendingAction();

  if (
    checkoutIntents.length === 0 &&
    pendingEvents.length === 0 &&
    plansEndingSoon.length === 0 &&
    addonsEndingSoon.length === 0 &&
    orgsOverSeats.length === 0
  ) {
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

  async function replayEvent(eventId: string) {
    setMessage(null);
    const form = new FormData();
    form.set('eventId', eventId);
    const result = await run(() => replaySuperadminBillingEvent(form));
    if (!result) return;
    setMessage(result.success ? 'Webhook reaplicado' : result.error ?? 'No se pudo reaplicar');
    if (result.success) router.refresh();
  }

  async function skipEvent(eventId: string) {
    setMessage(null);
    const form = new FormData();
    form.set('eventId', eventId);
    const result = await run(() => skipSuperadminBillingEvent(form));
    if (!result) return;
    setMessage(
      result.success
        ? (result.data?.released ?? 0) > 0
          ? 'Webhook omitido y pago en curso liberado'
          : 'Webhook omitido'
        : result.error ?? 'No se pudo omitir'
    );
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
              Eventos reclamados que todavía no se aplicaron. Reaplicá el mismo apply u omití si el
              cobro no va a completar. Omitir no cambia el plan y solo libera el checkout de ese cobro.
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
                  <th className="py-2" />
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
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => void replayEvent(event.id)}
                        >
                          Reaplicar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => void skipEvent(event.id)}
                        >
                          Omitir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {plansEndingSoon.length > 0 ? (
        <Card id="planes-por-vencer">
          <CardHeader>
            <CardTitle className="text-lg">Planes por vencer</CardTitle>
            <CardDescription>
              Planes públicos en la ventana de aviso. Los días son anticipación, no la duración del
              plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Clínica</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Vence</th>
                </tr>
              </thead>
              <tbody>
                {plansEndingSoon.map((row) => (
                  <tr key={row.organizationId} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/superadmin/organizaciones/${row.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {row.organizationName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.organizationSlug}</div>
                    </td>
                    <td className="py-2">{row.planName}</td>
                    <td className="py-2">
                      <Badge variant={row.status === 'past_due' ? 'destructive' : 'warning'}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(row.endsAt).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {addonsEndingSoon.length > 0 ? (
        <Card id="extras-por-vencer">
          <CardHeader>
            <CardTitle className="text-lg">Extras por vencer</CardTitle>
            <CardDescription>
              Add-ons activos en la misma ventana de aviso. El extra deja de sumar features al
              vencer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Clínica</th>
                  <th className="py-2">Extra</th>
                  <th className="py-2">Vence</th>
                </tr>
              </thead>
              <tbody>
                {addonsEndingSoon.map((row) => (
                  <tr key={`${row.organizationId}:${row.addonKey}`} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/superadmin/organizaciones/${row.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {row.organizationName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.organizationSlug}</div>
                    </td>
                    <td className="py-2">{row.addonName}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(row.endsAt).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {orgsOverSeats.length > 0 ? (
        <Card id="sobre-cupos">
          <CardHeader>
            <CardTitle className="text-lg">Sobre cupos</CardTitle>
            <CardDescription>
              Clínicas cuya ocupación o uso del mes supera un cupo finito del plan. Legacy no entra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Clínica</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Cupo</th>
                </tr>
              </thead>
              <tbody>
                {orgsOverSeats.map((row) => (
                  <tr key={`${row.organizationId}:${row.featureKey}`} className="border-t">
                    <td className="py-2">
                      <Link
                        href={`/superadmin/organizaciones/${row.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {row.organizationName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.organizationSlug}</div>
                    </td>
                    <td className="py-2">{row.planName}</td>
                    <td className="py-2">
                      {formatMeteredUsage({
                        featureKey: row.featureKey,
                        label: quotaUsageLabel(row.featureKey),
                        used: row.used,
                        limit: row.limitValue,
                      })}
                      <div className="text-xs text-muted-foreground">
                        {quotaUsageLabel(row.featureKey)}
                      </div>
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
