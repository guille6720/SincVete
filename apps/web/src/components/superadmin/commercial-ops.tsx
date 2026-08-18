'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  runSuperadminCommercialLifecycle,
  type SuperadminCommercialSummary,
} from '@/actions/superadmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

export function SuperadminCommercialOps({ summary }: { summary: SuperadminCommercialSummary }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, run] = usePendingAction();

  async function runLifecycle() {
    setMessage(null);
    const result = await run(() => runSuperadminCommercialLifecycle());
    if (!result) return;
    if (result.success && result.data) {
      setMessage(
        `Ciclo comercial: ${result.data.expired} vencidas, ${result.data.notices} avisos.`
      );
      router.refresh();
      return;
    }
    setMessage(result.error ?? 'No se pudo ejecutar el ciclo');
  }

  const cards = [
    { label: 'Clínicas', value: summary.organizations },
    { label: 'Trial', value: summary.trialing },
    { label: 'Activas', value: summary.active },
    { label: 'Pago pendiente', value: summary.pastDue },
    { label: 'Vencidas', value: summary.expired },
    { label: 'Canceladas', value: summary.cancelled },
    { label: 'Planes por vencer', value: summary.plansEndingSoon },
    { label: 'Extras activos', value: summary.addonsActive },
    { label: 'Extras por vencer', value: summary.addonsEndingSoon },
    { label: 'Sobre cupos', value: summary.orgsOverSeats },
    { label: 'Webhooks pendientes', value: summary.billingEventsPending },
    { label: 'Pagos en curso', value: summary.checkoutIntentsOpen },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void runLifecycle()}>
          Vencer planes/extras y enviar avisos
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
