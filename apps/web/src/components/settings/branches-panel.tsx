'use client';

import { useActionState, useEffect, useState } from 'react';
import { createBranch, deleteBranch, updateBranch } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  APP_TIMEZONE,
  TIMEZONES,
  formatMeteredUsage,
  generateBranchCode,
  isQuotaNearLimit,
  type Branch,
  type PaginatedResult,
  type SeatUsageMeter,
} from '@sincvete/shared';

interface BranchesPanelProps {
  initialData: PaginatedResult<Branch>;
  seatMeter?: SeatUsageMeter;
}

function BranchCreateForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createBranch, null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (state?.success) onDone();
  }, [state?.success, onDone]);

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-name">Nombre</Label>
          <Input id="new-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-code">Código</Label>
          <Input id="new-code" name="code" defaultValue={generateBranchCode(name)} required className="uppercase" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-address">Dirección</Label>
        <Input id="new-address" name="address" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-phone">Teléfono</Label>
          <Input id="new-phone" name="phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-tz">Zona horaria</Label>
          <Select id="new-tz" name="timezone" defaultValue={APP_TIMEZONE}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Guardando...' : 'Crear sucursal'}
      </Button>
    </form>
  );
}

function BranchEditForm({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const boundUpdate = updateBranch.bind(null, branch.id);
  const [state, formAction, pending] = useActionState(boundUpdate, null);

  useEffect(() => {
    if (state?.success) onDone();
  }, [state?.success, onDone]);

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`name-${branch.id}`}>Nombre</Label>
          <Input id={`name-${branch.id}`} name="name" defaultValue={branch.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`code-${branch.id}`}>Código</Label>
          <Input id={`code-${branch.id}`} name="code" defaultValue={branch.code} required className="uppercase" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`address-${branch.id}`}>Dirección</Label>
        <Input id={`address-${branch.id}`} name="address" defaultValue={branch.address ?? ''} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`phone-${branch.id}`}>Teléfono</Label>
          <Input id={`phone-${branch.id}`} name="phone" defaultValue={branch.phone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`tz-${branch.id}`}>Zona horaria</Label>
          <Select id={`tz-${branch.id}`} name="timezone" defaultValue={branch.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="hidden" name="isActive" value="false" />
        <input type="checkbox" name="isActive" value="true" defaultChecked={branch.is_active} />
        Sucursal activa
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Guardando...' : 'Actualizar'}
      </Button>
    </form>
  );
}

export function BranchesPanel({ initialData, seatMeter }: BranchesPanelProps) {
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Sucursales</CardTitle>
            <CardDescription>
              {initialData.total} sucursal{initialData.total !== 1 ? 'es' : ''} registrada
              {initialData.total !== 1 ? 's' : ''}
              {seatMeter ? (
                <span className={isQuotaNearLimit(seatMeter) ? ' text-amber-700 dark:text-amber-300' : ''}>
                  {' '}
                  · {formatMeteredUsage(seatMeter)}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowNew((v) => !v)}>
            {showNew ? 'Cancelar' : 'Nueva sucursal'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNew && (
            <BranchCreateForm
              onDone={() => {
                setShowNew(false);
                window.location.reload();
              }}
            />
          )}

          {initialData.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sucursales registradas.</p>
          ) : (
            <div className="space-y-3">
              {initialData.data.map((branch) => (
                <div key={branch.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{branch.name}</p>
                        <Badge variant="default">{branch.code}</Badge>
                        {branch.is_main && <Badge variant="warning">Principal</Badge>}
                        {!branch.is_active && <Badge variant="destructive">Inactiva</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {branch.address || 'Sin dirección'} · {branch.timezone}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingId((current) => (current === branch.id ? null : branch.id))
                        }
                      >
                        Editar
                      </Button>
                      {!branch.is_main && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (confirm('¿Eliminar esta sucursal?')) {
                              await deleteBranch(branch.id);
                              window.location.reload();
                            }
                          }}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingId === branch.id && (
                    <div className="mt-4">
                      <BranchEditForm
                        branch={branch}
                        onDone={() => {
                          setEditingId(null);
                          window.location.reload();
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
