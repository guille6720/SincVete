'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify } from '@sincvete/shared';
import { BrandLogo } from '@/components/brand/sincvete-logo';

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUp, null);
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(orgName));
    }
  }, [orgName, slugTouched]);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="space-y-4 text-center">
        <div className="flex justify-center">
          <BrandLogo href="/" size="lg" priority />
        </div>
        <div>
          <CardTitle>Registrá tu clínica</CardTitle>
          <CardDescription>Creá tu clínica y comenzá en minutos</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Tu nombre</Label>
              <Input id="fullName" name="fullName" required placeholder="Dr. Juan Pérez" />
              {state?.fieldErrors?.fullName && (
                <p className="text-sm text-destructive">{state.fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organizationName">Nombre de la clínica</Label>
              <Input
                id="organizationName"
                name="organizationName"
                required
                placeholder="Clínica Veterinaria San Roque"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              {state?.fieldErrors?.organizationName && (
                <p className="text-sm text-destructive">{state.fieldErrors.organizationName[0]}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organizationSlug">Identificador (URL)</Label>
              <Input
                id="organizationSlug"
                name="organizationSlug"
                required
                placeholder="san-roque"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
              />
              {state?.fieldErrors?.organizationSlug && (
                <p className="text-sm text-destructive">{state.fieldErrors.organizationSlug[0]}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="branchName">Sucursal principal</Label>
              <Input
                id="branchName"
                name="branchName"
                defaultValue="Sucursal Principal"
                placeholder="Sucursal Principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="tu@email.com" />
              {state?.fieldErrors?.email && (
                <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required placeholder="••••••••" />
              {state?.fieldErrors?.password && (
                <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
              )}
            </div>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creando clínica...' : 'Crear clínica'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Ingresar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
