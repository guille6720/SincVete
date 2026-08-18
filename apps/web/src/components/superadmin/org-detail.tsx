'use client';

import Link from 'next/link';
import { useState } from 'react';
import { COMMERCIAL_PLAN_KEYS, SUPERADMIN_ASSIGNABLE_PLAN_KEYS, formatBillingEventLabel, formatMeteredUsage, isPublicPricingPlanKey, isQuotaNearLimit } from '@sincvete/shared';
import type { SuperadminBillingEvent, SuperadminCheckoutIntent, SuperadminOrgCommercial } from '@/actions/superadmin';
import {
  cancelSuperadminCheckoutIntents,
  changeOrganizationPlan,
  clearOrganizationFeatureOverride,
  endOrganizationTrial,
  grantOrganizationAddon,
  replaySuperadminBillingEvent,
  revokeOrganizationAddon,
  reverseSuperadminPaidGrant,
  setOrganizationFeatureOverride,
  skipSuperadminBillingEvent,
  startOrganizationTrial,
} from '@/actions/superadmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

function sourceVariant(source: string) {
  if (source === 'override') return 'warning' as const;
  if (source === 'addon') return 'default' as const;
  if (source === 'plan') return 'success' as const;
  if (source === 'deny') return 'destructive' as const;
  return 'default' as const;
}

export function SuperadminOrgDetail({
  data,
  events = [],
  checkoutIntents = [],
}: {
  data: SuperadminOrgCommercial;
  events?: SuperadminBillingEvent[];
  checkoutIntents?: SuperadminCheckoutIntent[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, run] = usePendingAction();
  const orgId = data.organization.id;

  async function handle(action: () => Promise<{ success: boolean; error?: string }>) {
    setMessage(null);
    const result = await run(action);
    if (!result) return;
    setMessage(result.success ? 'Cambio guardado' : result.error ?? 'No se pudo guardar');
  }

  const assignable = data.plans.filter((plan) =>
    (SUPERADMIN_ASSIGNABLE_PLAN_KEYS as readonly string[]).includes(plan.key)
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin" className="text-sm text-muted-foreground hover:underline">
          ← Organizaciones
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.organization.name}</h1>
        <p className="text-muted-foreground">{data.organization.slug}</p>
      </div>

      {message ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Suscripción</CardTitle>
          <CardDescription>Fuente comercial actual. Legacy solo con confirmación explícita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {data.subscription ? (
              <>
                <Badge>{data.subscription.planName}</Badge>
                <Badge
                  variant={
                    data.subscription.status === 'trialing'
                      ? 'warning'
                      : data.subscription.status === 'active'
                        ? 'success'
                        : 'destructive'
                  }
                >
                  {data.subscription.status}
                </Badge>
                {data.subscription.isInternal ? <Badge variant="destructive">interno</Badge> : null}
                {data.subscription.trialEndsAt ? (
                  <span className="text-muted-foreground">
                    Trial hasta {new Date(data.subscription.trialEndsAt).toLocaleString('es-AR')}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Sin suscripción vigente</span>
            )}
          </div>

          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void handle(() => changeOrganizationPlan(form));
            }}
          >
            <input type="hidden" name="organizationId" value={orgId} />
            <div className="space-y-1">
              <Label htmlFor="planKey">Cambiar plan</Label>
              <Select id="planKey" name="planKey" defaultValue={data.subscription?.planKey ?? 'basic'}>
                {assignable.map((plan) => (
                  <option key={plan.key} value={plan.key}>
                    {plan.name}
                  </option>
                ))}
                <option value={COMMERCIAL_PLAN_KEYS.LEGACY}>Legacy (solo explícito)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Motivo</Label>
              <Input id="reason" name="reason" placeholder="motivo del cambio" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="allowLegacy" />
              Confirmo asignar legacy (migración / Superadmin explícito)
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="allowOverSeats" />
              Asignar igual si la clínica ya supera los cupos del plan
            </label>
            <Button type="submit" isPending={pending} className="md:col-span-2 w-fit">
              Guardar plan
            </Button>
          </form>

          {data.subscription &&
          (data.subscription.status === 'active' || data.subscription.status === 'past_due') &&
          isPublicPricingPlanKey(data.subscription.planKey) ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void handle(() => reverseSuperadminPaidGrant(form));
              }}
            >
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="kind" value="plan" />
              <input type="hidden" name="targetKey" value={data.subscription.planKey} />
              <Button type="submit" variant="outline" size="sm" isPending={pending}>
                Revertir cobro del plan
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Si Mercado Pago o Stripe reembolsaron y el webhook no llegó. No toca legacy ni trial.
              </p>
            </form>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <form
              className="space-y-2 rounded-md border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void handle(() => startOrganizationTrial(form));
              }}
            >
              <p className="text-sm font-medium">Iniciar trial</p>
              <input type="hidden" name="organizationId" value={orgId} />
              <Input name="trialDays" type="number" min={1} placeholder="días (vacío = abierto)" />
              <Input name="reason" placeholder="motivo" />
              <Button type="submit" variant="outline" isPending={pending}>
                Iniciar trial
              </Button>
            </form>

            <form
              className="space-y-2 rounded-md border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void handle(() => endOrganizationTrial(form));
              }}
            >
              <p className="text-sm font-medium">Terminar trial</p>
              <input type="hidden" name="organizationId" value={orgId} />
              <Select name="planKey" defaultValue="basic">
                {assignable
                  .filter((plan) => plan.key !== 'trial')
                  .map((plan) => (
                    <option key={plan.key} value={plan.key}>
                      {plan.name}
                    </option>
                  ))}
              </Select>
              <Input name="reason" placeholder="motivo" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allowOverSeats" />
                Asignar igual si supera los cupos
              </label>
              <Button type="submit" variant="outline" isPending={pending}>
                Terminar trial
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add-ons</CardTitle>
          <CardDescription>
            Extras sobre el plan (IA, WhatsApp, portal, imágenes, reportes). No hay checkout: Superadmin
            los otorga. Un add-on vencido o cancelado deja de sumar features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.organizationAddons.filter((row) => row.status === 'active').length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin add-ons activos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.organizationAddons
                .filter((row) => row.status === 'active')
                .map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{row.addonName}</span>
                      {row.endsAt ? (
                        <span className="text-muted-foreground">
                          {' '}
                          hasta {new Date(row.endsAt).toLocaleString('es-AR')}
                        </span>
                      ) : null}
                      {row.reason ? (
                        <span className="text-muted-foreground"> · {row.reason}</span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap gap-1">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void handle(() => revokeOrganizationAddon(form));
                      }}
                    >
                      <input type="hidden" name="organizationId" value={orgId} />
                      <input type="hidden" name="addonKey" value={row.addonKey} />
                      <Button type="submit" size="sm" variant="ghost" isPending={pending}>
                        Quitar
                      </Button>
                    </form>
                    {row.reason === 'checkout' ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          void handle(() => reverseSuperadminPaidGrant(form));
                        }}
                      >
                        <input type="hidden" name="organizationId" value={orgId} />
                        <input type="hidden" name="kind" value="addon" />
                        <input type="hidden" name="targetKey" value={row.addonKey} />
                        <Button type="submit" size="sm" variant="ghost" isPending={pending}>
                          Revertir cobro
                        </Button>
                      </form>
                    ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void handle(() => grantOrganizationAddon(form));
            }}
          >
            <input type="hidden" name="organizationId" value={orgId} />
            <div className="space-y-1">
              <Label htmlFor="addonKey">Otorgar add-on</Label>
              <Select id="addonKey" name="addonKey" required>
                {data.addonCatalog.map((addon) => (
                  <option key={addon.key} value={addon.key}>
                    {addon.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="addonEndsAt">Hasta (opcional)</Label>
              <Input id="addonEndsAt" name="endsAt" type="datetime-local" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="addonReason">Motivo</Label>
              <Textarea id="addonReason" name="reason" rows={2} />
            </div>
            <Button type="submit" isPending={pending} className="w-fit">
              Otorgar add-on
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Resolución: override → add-on → plan → default → deny. Activar/desactivar crea un override.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Feature</th>
                <th className="py-2 pr-2">On</th>
                <th className="py-2 pr-2">Límite</th>
                <th className="py-2 pr-2">Fuente</th>
                <th className="py-2 pr-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.map((feature) => {
                const resolved = data.entitlements[feature.key];
                return (
                  <tr key={feature.key} className="border-t align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{feature.name}</div>
                      <div className="text-xs text-muted-foreground">{feature.key}</div>
                    </td>
                    <td className="py-2 pr-2">{resolved?.enabled ? 'sí' : 'no'}</td>
                    <td className="py-2 pr-2">
                      {resolved?.limit === null ? 'ilimitado' : String(resolved?.limit ?? 0)}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge variant={sourceVariant(resolved?.source ?? 'deny')}>
                        {resolved?.source ?? 'deny'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void handle(() => setOrganizationFeatureOverride(form));
                          }}
                        >
                          <input type="hidden" name="organizationId" value={orgId} />
                          <input type="hidden" name="featureKey" value={feature.key} />
                          <input type="hidden" name="enabled" value="true" />
                          <Button type="submit" size="sm" variant="outline" isPending={pending}>
                            Activar
                          </Button>
                        </form>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void handle(() => setOrganizationFeatureOverride(form));
                          }}
                        >
                          <input type="hidden" name="organizationId" value={orgId} />
                          <input type="hidden" name="featureKey" value={feature.key} />
                          <input type="hidden" name="enabled" value="false" />
                          <Button type="submit" size="sm" variant="outline" isPending={pending}>
                            Desactivar
                          </Button>
                        </form>
                        <form
                          className="flex gap-1"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void handle(() => setOrganizationFeatureOverride(form));
                          }}
                        >
                          <input type="hidden" name="organizationId" value={orgId} />
                          <input type="hidden" name="featureKey" value={feature.key} />
                          <input type="hidden" name="enabled" value="true" />
                          <Input
                            name="limitValue"
                            className="h-8 w-20"
                            placeholder="límite"
                            disabled={feature.featureType !== 'limit'}
                          />
                          <Button type="submit" size="sm" variant="outline" isPending={pending}>
                            Límite
                          </Button>
                        </form>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void handle(() => clearOrganizationFeatureOverride(form));
                          }}
                        >
                          <input type="hidden" name="organizationId" value={orgId} />
                          <input type="hidden" name="featureKey" value={feature.key} />
                          <Button type="submit" size="sm" variant="ghost" isPending={pending}>
                            Quitar override
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acceso temporal</CardTitle>
          <CardDescription>Override con ventana starts_at / ends_at (UTC).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void handle(() => setOrganizationFeatureOverride(form));
            }}
          >
            <input type="hidden" name="organizationId" value={orgId} />
            <input type="hidden" name="enabled" value="true" />
            <div className="space-y-1">
              <Label htmlFor="tempFeature">Feature</Label>
              <Select id="tempFeature" name="featureKey" required>
                {data.catalog.map((feature) => (
                  <option key={feature.key} value={feature.key}>
                    {feature.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="limitValue">Límite (opcional)</Label>
              <Input id="limitValue" name="limitValue" placeholder="vacío = sin tope extra" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startsAt">Desde</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endsAt">Hasta</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="tempReason">Motivo</Label>
              <Textarea id="tempReason" name="reason" rows={2} />
            </div>
            <Button type="submit" isPending={pending} className="w-fit">
              Conceder acceso temporal
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cupos</CardTitle>
          <CardDescription>Ocupación actual: usuarios, sucursales, veterinarios y pacientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.seats.map((meter) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Uso</CardTitle>
          <CardDescription>Contadores medidos del mes frente al cupo del plan o extra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            {data.meters.map((meter) => (
              <div key={meter.featureKey} className="flex items-center justify-between gap-3">
                <span>{meter.label}</span>
                <span
                  className={
                    meter.limit != null && meter.used > meter.limit
                      ? 'text-destructive'
                      : isQuotaNearLimit(meter)
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-muted-foreground'
                  }
                >
                  {formatMeteredUsage(meter)}
                </span>
              </div>
            ))}
          </div>
          {data.usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin usage registrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Feature</th>
                  <th className="py-2">Periodo</th>
                  <th className="py-2">Uso</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((row) => (
                  <tr key={`${row.featureKey}-${row.periodStart}`} className="border-t">
                    <td className="py-2">{row.featureKey}</td>
                    <td className="py-2">
                      {row.periodStart} → {row.periodEnd}
                    </td>
                    <td className="py-2">{row.usageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos en curso</CardTitle>
          <CardDescription>
            Checkouts iniciados que todavía no aplicó el webhook. Liberá el aviso de la clínica si el
            pago no va a completar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checkoutIntents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay un pago en curso.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Clave</th>
                    <th className="py-2">Proveedor</th>
                    <th className="py-2">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {checkoutIntents.map((intent) => (
                    <tr key={intent.id} className="border-t">
                      <td className="py-2">{intent.kind === 'addon' ? 'Extra' : 'Plan'}</td>
                      <td className="py-2">{intent.targetKey}</td>
                      <td className="py-2">{intent.provider}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(intent.expiresAt).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  const form = new FormData();
                  form.set('organizationId', orgId);
                  void handle(() => cancelSuperadminCheckoutIntents(form));
                }}
              >
                Liberar pagos en curso
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>
            Webhooks de Mercado Pago / Stripe. Sin payload completo. Omitir un pendiente libera el
            pago en curso y no revierte el plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos de pago.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Evento</th>
                  <th className="py-2">Proveedor</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Cuando</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="py-2">{formatBillingEventLabel(event.eventType)}</td>
                    <td className="py-2">{event.provider}</td>
                    <td className="py-2">
                      {event.appliedAt ? (
                        <Badge variant="success">aplicado</Badge>
                      ) : (
                        <Badge variant="warning">pendiente</Badge>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(event.processedAt).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 text-right">
                      {event.appliedAt ? null : (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              const form = new FormData();
                              form.set('eventId', event.id);
                              void handle(() => replaySuperadminBillingEvent(form));
                            }}
                          >
                            Reaplicar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              const form = new FormData();
                              form.set('eventId', event.id);
                              void handle(() => skipSuperadminBillingEvent(form));
                            }}
                          >
                            Omitir
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
