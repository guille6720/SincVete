import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '@sincvete/shared';

export function RolesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles y permisos</CardTitle>
        <CardDescription>
          Referencia de accesos por rol. Los permisos se aplican automáticamente según el rol
          asignado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ROLES.map((role) => (
          <div key={role} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="font-medium">{ROLE_LABELS[role]}</p>
              <Badge>{ROLE_PERMISSIONS[role].length} permisos</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS.map((permission) => {
                const enabled = ROLE_PERMISSIONS[role].includes(permission);
                return (
                  <Badge
                    key={permission}
                    variant={enabled ? 'success' : 'default'}
                    className={enabled ? '' : 'opacity-40'}
                  >
                    {PERMISSION_LABELS[permission] ?? permission}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
