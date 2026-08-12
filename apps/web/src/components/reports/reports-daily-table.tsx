import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDashboardDate, formatMoney, type ReportDailyRow } from '@sincvete/shared';

interface ReportsDailyTableProps {
  rows: ReportDailyRow[];
  showPayments: boolean;
  currency?: string;
}

export function ReportsDailyTable({
  rows,
  showPayments,
  currency = 'ARS',
}: ReportsDailyTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad diaria</CardTitle>
        <CardDescription>Citas, consultas completadas y cobros</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividad en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Día</th>
                  <th className="py-2 pr-4 font-medium">Citas</th>
                  <th className="py-2 pr-4 font-medium">Consultas</th>
                  {showPayments && <th className="py-2 font-medium">Cobros</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.day} className="border-b last:border-0">
                    <td className="py-2 pr-4">{formatDashboardDate(`${row.day}T12:00:00.000Z`)}</td>
                    <td className="py-2 pr-4">{row.appointments}</td>
                    <td className="py-2 pr-4">{row.consultations}</td>
                    {showPayments && (
                      <td className="py-2">{formatMoney(row.payments_total, currency)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
