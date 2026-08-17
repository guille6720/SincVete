'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/actions/auth';
import { BrandLogo } from '@/components/brand/syncvete-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4 text-center">
        <div className="flex justify-center">
          <BrandLogo href="/" size="lg" priority />
        </div>
        <div>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>
            Te enviamos un enlace a tu email para elegir una nueva contraseña
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {state?.success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Si existe una cuenta con ese email, vas a recibir un enlace en unos minutos. Revisá
              también la carpeta de spam.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Volver al inicio de sesión</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@email.com"
              />
              {state?.fieldErrors?.email && (
                <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
