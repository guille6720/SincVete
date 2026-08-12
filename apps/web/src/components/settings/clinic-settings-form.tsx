'use client';

import { useActionState } from 'react';
import { updateOrganizationSettings } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { CURRENCIES, TIMEZONES, type OrganizationSettings } from '@sincvete/shared';

interface ClinicSettingsFormProps {
  organizationName: string;
  settings: OrganizationSettings;
}

export function ClinicSettingsForm({ organizationName, settings }: ClinicSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la clínica</CardTitle>
        <CardDescription>Información general y preferencias regionales</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-xl gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la clínica</Label>
            <Input id="name" name="name" defaultValue={organizationName} required />
            {state?.fieldErrors?.name && (
              <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Select id="timezone" name="timezone" defaultValue={settings.timezone}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select id="currency" name="currency" defaultValue={settings.currency ?? 'ARS'}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" defaultValue={settings.phone ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de contacto</Label>
              <Input id="email" name="email" type="email" defaultValue={settings.email ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">CUIT / Identificación fiscal</Label>
            <Input id="taxId" name="taxId" defaultValue={settings.taxId ?? ''} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.success && (
            <p className="text-sm text-emerald-600">Configuración guardada correctamente</p>
          )}

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
