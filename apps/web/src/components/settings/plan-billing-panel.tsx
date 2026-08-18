'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelClinicSubscription,
  startBillingPortal,
  startPlanCheckout,
  type PlanBillingState,
} from '@/actions/plan-billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { canCheckoutPlan, formatArsAmount } from '@sincvete/shared';
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

  return (
    <div className="space-y-6">
      {checkoutBanner === 'success' ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Pago recibido. El plan se actualiza cuando el proveedor confirma el webhook.
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
            El trial se crea al registrar la clínica. El upgrade se cobra por Mercado Pago o Stripe.
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
            <span className="text-muted-foreground">
              Vigente hasta {new Date(state.current.endsAt).toLocaleDateString('es-AR')}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {state.usage.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uso del mes</CardTitle>
            <CardDescription>Cupos del plan actual. El contador se reinicia cada mes (UTC).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state.usage.map((meter) => {
              const unit = meter.featureKey === 'storage.max_mb' ? ' MB' : '';
              let value = 'No incluido';
              if (meter.limit === null) value = `${meter.used}${unit} / ilimitado`;
              else if (meter.limit > 0) value = `${meter.used} / ${meter.limit}${unit}`;
              return (
                <div key={meter.featureKey} className="flex items-center justify-between gap-3">
                  <span>{meter.label}</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              );
            })}
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
                {plan.pricing.cta === 'contact' || !canCheckoutPlan(plan.pricing) ? (
                  <p className="text-muted-foreground">Escribinos para Enterprise.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !state.configured || current}
                      onClick={() => void checkout(plan.key, 'monthly')}
                    >
                      Mensual
                    </Button>
                    {plan.pricing.annualAmount ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || !state.configured || current}
                        onClick={() => void checkout(plan.key, 'annual')}
                      >
                        Anual
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
