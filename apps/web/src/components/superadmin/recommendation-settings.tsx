'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  saveSuperadminRecommendationSettings,
  type SuperadminCommercialSummary,
} from '@/actions/superadmin';
import type { RecommendationSettings } from '@/lib/plan-recommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

export function SuperadminRecommendationSettingsCard({
  settings,
}: {
  settings: RecommendationSettings | null;
  summary?: SuperadminCommercialSummary;
}) {
  const router = useRouter();
  const [pending, run] = usePendingAction();
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState(String(settings?.thresholdInfo ?? 0.7));
  const [warning, setWarning] = useState(String(settings?.thresholdWarning ?? 0.85));
  const [critical, setCritical] = useState(String(settings?.thresholdCritical ?? 1));
  const [snoozeDays, setSnoozeDays] = useState(String(settings?.clinicSnoozeDays ?? 14));

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Umbrales de recomendación</CardTitle>
          <CardDescription>
            Aplicá phase 36 en Supabase para editar umbrales y snooze de clínica.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="umbrales-recomendacion">
      <CardHeader>
        <CardTitle>Umbrales de recomendación</CardTitle>
        <CardDescription>
          Valores centralizados del motor. No cambian planes automáticamente. El snooze oculta el
          aviso suave de la clínica por N días.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="thInfo">Info (ej. 0.70)</Label>
            <Input id="thInfo" value={info} onChange={(e) => setInfo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="thWarn">Warning (ej. 0.85)</Label>
            <Input id="thWarn" value={warning} onChange={(e) => setWarning(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="thCrit">Critical (ej. 1.00)</Label>
            <Input id="thCrit" value={critical} onChange={(e) => setCritical(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="snooze">Snooze clínica (días)</Label>
            <Input
              id="snooze"
              type="number"
              min={1}
              max={90}
              value={snoozeDays}
              onChange={(e) => setSnoozeDays(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              const form = new FormData();
              form.set('thresholdInfo', info);
              form.set('thresholdWarning', warning);
              form.set('thresholdCritical', critical);
              form.set('clinicSnoozeDays', snoozeDays);
              void run(async () => {
                const result = await saveSuperadminRecommendationSettings(form);
                setMessage(
                  result.success ? 'Umbrales guardados' : result.error ?? 'No se pudo guardar'
                );
                if (result.success) router.refresh();
                return result;
              });
            }}
          >
            Guardar umbrales
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
