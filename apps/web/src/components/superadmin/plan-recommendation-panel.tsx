'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PlanRecommendation } from '@sincvete/shared';
import {
  changeOrganizationPlan,
  dismissOrganizationPlanRecommendation,
  reviewOrganizationPlanRecommendation,
  saveOrganizationPlanRecommendationFollowUp,
  saveOrganizationPlanRecommendationNote,
} from '@/actions/superadmin';
import type { PlanRecommendationCommercialMeta } from '@/lib/plan-recommendations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

export function SuperadminPlanRecommendationPanel({
  organizationId,
  organizationName,
  recommendation,
  comparison,
  commercialMeta = null,
}: {
  organizationId: string;
  organizationName: string;
  recommendation: PlanRecommendation;
  comparison: {
    gained: string[];
    lost: string[];
    limitChanges: Array<{ label: string; from: string; to: string }>;
  } | null;
  commercialMeta?: PlanRecommendationCommercialMeta | null;
}) {
  const router = useRouter();
  const [pending, run] = usePendingAction();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(commercialMeta?.commercialNote ?? '');
  const [followUpLocal, setFollowUpLocal] = useState(() => {
    if (!commercialMeta?.followUpAt) return '';
    const d = new Date(commercialMeta.followUpAt);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const showAlert =
    recommendation.shouldRecommendUpgrade ||
    recommendation.upgradeStatus === 'legacy_review' ||
    recommendation.upgradeStatus === 'trial_conversion';

  if (!showAlert && recommendation.upgradeStatus === 'none') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recomendación comercial</CardTitle>
          <CardDescription>Sin upgrade recomendado con el uso actual.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Uso máximo: {Math.round(Math.min(recommendation.usageLevel, 1) * 100)}%
        </CardContent>
      </Card>
    );
  }

  async function applyPlan() {
    if (!recommendation.recommendedPlan) return;
    setMessage(null);
    const form = new FormData();
    form.set('organizationId', organizationId);
    form.set('planKey', recommendation.recommendedPlan);
    form.set(
      'reason',
      reason.trim() ||
        `Aceptar recomendación ${recommendation.currentPlan} → ${recommendation.recommendedPlan}`
    );
    const result = await run(() => changeOrganizationPlan(form));
    if (!result) return;
    setMessage(result.success ? 'Plan actualizado' : result.error ?? 'No se pudo cambiar el plan');
    if (result.success) router.refresh();
  }

  return (
    <Card className="border-amber-300/60">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {recommendation.upgradeStatus === 'legacy_review'
            ? 'LEGACY — REVISIÓN COMERCIAL'
            : 'UPGRADE RECOMMENDED'}
          <Badge variant="warning">{recommendation.severity}</Badge>
        </CardTitle>
        <CardDescription>
          {organizationName} está en <strong>{recommendation.currentPlan ?? 'sin plan'}</strong>
          {recommendation.recommendedPlan
            ? `. Según el uso, recomendamos ${recommendation.recommendedPlan}.`
            : '.'}{' '}
          El plan no cambia solo: hace falta una acción explícita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div>
          <p className="mb-2 text-sm font-medium">Motivos</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {recommendation.reasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {comparison ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">Features ganadas</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {comparison.gained.length === 0 ? <li>Ninguna</li> : null}
                {comparison.gained.slice(0, 12).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Límites</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {comparison.limitChanges.length === 0 ? <li>Sin cambios de cupo</li> : null}
                {comparison.limitChanges.slice(0, 8).map((item) => (
                  <li key={item.label}>
                    {item.label}: {item.from} → {item.to}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="recReason">Motivo del cambio (auditoría)</Label>
          <Textarea
            id="recReason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="recNote">Nota comercial interna</Label>
          <Textarea
            id="recNote"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Solo Superadmin. No se muestra a la clínica."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const form = new FormData();
                form.set('organizationId', organizationId);
                form.set('note', note);
                void run(async () => {
                  const result = await saveOrganizationPlanRecommendationNote(form);
                  setMessage(
                    result.success ? 'Nota guardada' : result.error ?? 'No se pudo guardar la nota'
                  );
                  if (result.success) router.refresh();
                  return result;
                });
              }}
            >
              Guardar nota
            </Button>
            {commercialMeta?.lastRefreshedAt ? (
              <span className="text-xs text-muted-foreground">
                Último refresh{' '}
                {new Date(commercialMeta.lastRefreshedAt).toLocaleString('es-AR')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="recFollowUp">Seguimiento comercial</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id="recFollowUp"
              type="datetime-local"
              value={followUpLocal}
              onChange={(event) => setFollowUpLocal(event.target.value)}
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const form = new FormData();
                form.set('organizationId', organizationId);
                form.set('followUpAt', followUpLocal);
                void run(async () => {
                  const result = await saveOrganizationPlanRecommendationFollowUp(form);
                  setMessage(
                    result.success
                      ? 'Seguimiento guardado'
                      : result.error ?? 'No se pudo guardar el seguimiento'
                  );
                  if (result.success) router.refresh();
                  return result;
                });
              }}
            >
              Guardar fecha
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending || !followUpLocal}
              onClick={() => {
                setFollowUpLocal('');
                const form = new FormData();
                form.set('organizationId', organizationId);
                form.set('followUpAt', '');
                void run(async () => {
                  const result = await saveOrganizationPlanRecommendationFollowUp(form);
                  setMessage(
                    result.success
                      ? 'Seguimiento quitado'
                      : result.error ?? 'No se pudo quitar el seguimiento'
                  );
                  if (result.success) router.refresh();
                  return result;
                });
              }}
            >
              Quitar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="#suscripcion">Ver detalle</Link>
          </Button>
          {recommendation.recommendedPlan ? (
            <Button type="button" disabled={pending} onClick={() => void applyPlan()}>
              Cambiar a {recommendation.recommendedPlan}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const form = new FormData();
              form.set('organizationId', organizationId);
              void run(async () => {
                const result = await dismissOrganizationPlanRecommendation(form);
                if (result.success) router.refresh();
                return result;
              });
            }}
          >
            Dismiss recommendation
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const form = new FormData();
              form.set('organizationId', organizationId);
              void run(async () => {
                const result = await reviewOrganizationPlanRecommendation(form);
                if (result.success) router.refresh();
                return result;
              });
            }}
          >
            Mark reviewed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
