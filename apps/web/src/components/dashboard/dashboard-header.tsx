import { ROLE_LABELS, type DashboardContext, type SessionContext } from '@sincvete/shared';

interface DashboardHeaderProps {
  session: SessionContext;
  context: DashboardContext | null;
}

export function DashboardHeader({ session, context }: DashboardHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Bienvenido, {session.profile.full_name}. Rol:{' '}
        {session.role ? ROLE_LABELS[session.role] : 'Portal'}
      </p>
      {context && (
        <p className="text-sm text-muted-foreground">
          {context.organizationName}
          {context.branchName ? ` · Sucursal ${context.branchName}` : ''}
        </p>
      )}
    </div>
  );
}
