import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SuperadminManual } from '@/components/manual/superadmin-manual';

export function SettingsSuperadminManualPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guía Superadmin</CardTitle>
        <CardDescription>
          Solo la ves vos. Cómo habilitar módulos a una clínica, planes, extras, cupos, pagos y qué
          se edita en Equipo / Roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SuperadminManual />
      </CardContent>
    </Card>
  );
}
