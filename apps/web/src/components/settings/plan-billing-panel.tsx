'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelClinicAddon,
  cancelClinicSubscription,
  startAddonCheckout,
  startBillingPortal,
  startPlanCheckout,
  type PlanBillingState,
} from '@/actions/plan-billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { canCheckoutPlan, formatArsAmount, formatBillingEventLabel, formatMeteredUsage, isQuotaNearLimit, canCheckoutAddonOffer } from '@sincvete/shared';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

function statusLabel(status: PlanBillingState['current']['status']) {
  if (status === 'trialing') return 'Trial';
  if (status === 'active') return 'Activa';
  if (status === 'past_due') return 'Pago pendiente';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'expired') return 'Vencida';
  return 'Sin suscripción';
}

export function PlanBillingPanel({
  state,
  checkoutBanner,
}: {
  state: PlanBillingState;
  checkoutBanner?: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, run] = usePendingAction();
  const router = useRouter();

  async function checkout(planKey: string, interval: 'monthly' | 'annual') {
    setMessage(null);
    const form = new FormData();
    form.set('planKey', planKey);
    form.set('interval', interval);
    const result = await run(() => startPlanCheckout(form));
    if (!result) return;
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error ?? 'No se pudo iniciar el checkout');
  }

  async function checkoutAddon(addonKey: string, interval: 'monthly' | 'annual') {
    setMessage(null);
    const form = new FormData();
    form.set('addonKey', addonKey);
    form.set('interval', interval);
    const result = await run(() => startAddonCheckout(form));
    if (!result) return;
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error ?? 'No se pudo iniciar el checkout del extra');
  }

  async function openPortal() {
    setMessage(null);
    const result = await run(() => startBillingPortal());
    if (!result) return;
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error ?? 'No se pudo abrir el portal');
  }

  async function cancelPlan() {
    setMessage(null);
    const result = await run(() => cancelClinicSubscription());
    if (!result) return;
    if (result.success) {
      setConfirmCancel(false);
      setMessage('Plan cancelado. Podés elegir otro cuando quieras.');
      router.refresh();
      return;
    }
    setMessage(result.error ?? 'No se pudo cancelar el plan');
  }

  async function cancelAddon(addonKey: string) {
    setMessage(null);
    const form = new FormData();
    form.set('addonKey', addonKey);
    const result = await run(() => cancelClinicAddon(form));
    if (!result) return;
    if (result.success) {
      setMessage('Extra cancelado.');
      router.refresh();
      return;
    }
    setMessage(result.error ?? 'No se pudo cancelar el extra');
  }

  return (
    <div className="space-y-6">
      {checkoutBanner === 'success' ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Pago recibido. El plan o extra se actualiza cuando el proveedor confirma el webhook.
        </p>
      ) : null}
      {checkoutBanner === 'cancel' ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Checkout cancelado.</p>
      ) : null}
      {checkoutBanner === 'pending' ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Pago pendiente. Te avisamos cuando Mercado Pago lo acredite.
        </p>
      ) : null}
      {message ? <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Plan actual</CardTitle>
          <CardDescription>
            El trial se crea al registrar la clínica. El plan de pago es por período: renovalo antes de
            que venza. Stripe con suscripción se extiende solo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <Badge>{state.current.planName ?? 'Sin plan'}</Badge>
          <Badge variant={state.current.status === 'active' ? 'success' : 'warning'}>
            {statusLabel(state.current.status)}
          </Badge>
          {state.current.trialEndsAt ? (
            <span className="text-muted-foreground">
              Trial hasta {new Date(state.current.trialEndsAt).toLocaleDateString('es-AR')}
            </span>
          ) : null}
          {state.current.endsAt ? (
            <span
              className={
                state.current.endingSoon ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
              }
            >
              Vigente hasta {new Date(state.current.endsAt).toLocaleDateString('es-AR')}
              {state.current.endingSoon ? ' · vence pronto, renovalo para no perderlo' : ''}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {state.addonOffers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Extras</CardTitle>
            <CardDescription>
              Módulos sueltos sobre el plan. Si tu plan ya los incluye, no hace falta comprarlos. El
              extra es un pago por período: renovalo antes de que venza.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {state.addonOffers.map((addon) => {
              const monthly = formatArsAmount(addon.pricing.monthlyAmount);
              return (
                <div key={addon.key} className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{addon.name}</span>
                    {addon.offerState === 'active' ? <Badge>Activo</Badge> : null}
                    {addon.offerState === 'included' ? <Badge variant="success">En tu plan</Badge> : null}
                  </div>
                  {addon.description ? (
                    <p className="text-muted-foreground">{addon.description}</p>
                  ) : null}
                  <p className="text-lg font-semibold">
                    {monthly ? `$ ${monthly}` : 'A medida'}
                    {monthly ? <span className="text-sm font-normal text-muted-foreground"> / mes</span> : null}
                  </p>
                  {addon.endsAt ? (
                    <p className={addon.endingSoon ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>
                      Hasta {new Date(addon.endsAt).toLocaleDateString('es-AR')}
                      {addon.endingSoon ? ' · vence pronto, renovalo para no perderlo' : ''}
                    </p>
                  ) : null}
                  {canCheckoutAddonOffer(addon.offerState) && canCheckoutPlan(addon.pricing) ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !state.configured}
                        onClick={() => void checkoutAddon(addon.key, 'monthly')}
                      >
                        {addon.offerState === 'active' ? 'Renovar mensual' : 'Mensual'}
                      </Button>
                      {addon.pricing.annualAmount ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || !state.configured}
                          onClick={() => void checkoutAddon(addon.key, 'annual')}
                        >
                          {addon.offerState === 'active' ? 'Renovar anual' : 'Anual'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {addon.offerState === 'blocked' ? (
                    <p className="text-muted-foreground">Elegí un plan comercial para comprar extras.</p>
                  ) : null}
                  {addon.canCancel ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void cancelAddon(addon.key)}
                    >
                      Cancelar extra
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {state.seats.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cupos</CardTitle>
            <CardDescription>Usuarios, sucursales, veterinarios y pacientes activos del plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state.seats.map((meter) => (
              <div key={meter.featureKey} className="flex items-center justify-between gap-3">
                <span>{meter.label}</span>
                <span
                  className={
                    isQuotaNearLimit(meter) ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                  }
                >
                  {formatMeteredUsage(meter)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {state.usage.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uso del mes</CardTitle>
            <CardDescription>Cupos del plan actual. El contador se reinicia cada mes (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state.usage.map((meter) => (
              <div key={meter.featureKey} className="flex items-center justify-between gap-3">
                <span>{meter.label}</span>
                <span
                  className={
                    isQuotaNearLimit(meter) ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
                  }
                >
                  {formatMeteredUsage(meter)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {state.events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historial de pagos</CardTitle>
            <CardDescription>Eventos confirmados por Mercado Pago o Stripe. Sin datos de la tarjeta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3">
                <span>
                  {formatBillingEventLabel(event.eventType)}
                  <span className="text-muted-foreground"> · {event.provider}</span>
                  {!event.appliedAt ? (
                    <span className="text-amber-700 dark:text-amber-300"> · pendiente</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {new Date(event.processedAt).toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!state.configured ? (
        <p className="text-sm text-muted-foreground">
          Los pagos todavía no están configurados en este ambiente. Superadmin puede asignar el plan
          mientras tanto.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {state.plans.map((plan) => {
          const current = state.current.planKey === plan.key;
          const monthly = formatArsAmount(plan.pricing.monthlyAmount);
          const seatBlock = state.seatBlocksByPlan[plan.key];
          return (
            <Card key={plan.key} className={plan.pricing.recommended ? 'border-primary' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {plan.name}
                  {current ? <Badge>Actual</Badge> : null}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-2xl font-semibold">
                  {monthly ? `$ ${monthly}` : 'A medida'}
                  {monthly ? <span className="text-sm font-normal text-muted-foreground"> / mes</span> : null}
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {plan.pricing.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {seatBlock ? <p className="text-amber-700 dark:text-amber-300">{seatBlock}</p> : null}
                {plan.pricing.cta === 'contact' || !canCheckoutPlan(plan.pricing) ? (
                  <p className="text-muted-foreground">Escribinos para Enterprise.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        pending || !state.configured || Boolean(seatBlock) || (current && !state.current.canRenew)
                      }
                      onClick={() => void checkout(plan.key, 'monthly')}
                    >
                      {current && state.current.canRenew ? 'Renovar mensual' : 'Mensual'}
                    </Button>
                    {plan.pricing.annualAmount ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          pending ||
                          !state.configured ||
                          Boolean(seatBlock) ||
                          (current && !state.current.canRenew)
                        }
                        onClick={() => void checkout(plan.key, 'annual')}
                      >
                        {current && state.current.canRenew ? 'Renovar anual' : 'Anual'}
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {state.hasStripeCustomer ? (
        <Button type="button" variant="outline" disabled={pending} onClick={() => void openPortal()}>
          Administrar facturación Stripe
        </Button>
      ) : null}

      {state.canCancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Cancelar plan</CardTitle>
            <CardDescription>
              El acceso se corta al cancelar. Los datos de la clínica no se borran. Legacy no se cancela
              desde acá.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {confirmCancel ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => void cancelPlan()}
                >
                  Sí, cancelar ahora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirmCancel(false)}
                >
                  Seguir con el plan
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar plan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
