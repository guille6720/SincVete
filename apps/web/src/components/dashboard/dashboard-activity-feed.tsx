import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime, type DashboardActivityItem } from '@sincvete/shared';

interface DashboardActivityFeedProps {
  activity: DashboardActivityItem[];
}

export function DashboardActivityFeed({ activity }: DashboardActivityFeedProps) {
  return (
    <Card className="border-sky-200/70 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Actividad reciente</CardTitle>
          <CardDescription>Cambios auditados en la clínica</CardDescription>
        </div>
        <Link href="/auditoria" className="text-xs font-medium text-teal-700 hover:underline">
          Ver auditoría
        </Link>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
        ) : (
          <ul className="divide-y">
            {activity.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/auditoria/${item.id}`}
                  className="flex items-start justify-between gap-3 hover:text-primary"
                >
                  <div>
                    <p className="text-sm">{item.summary}</p>
                    {item.userFullName && (
                      <p className="text-xs text-muted-foreground">por {item.userFullName}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
