import {
  BedDouble,
  Calendar,
  FlaskConical,
  Package,
  PawPrint,
  Receipt,
  Scissors,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import { ReportsPeriodFilter } from '@/components/reports/reports-period-filter';
import { ReportsStatGrid } from '@/components/reports/reports-stat-grid';
import { ReportsBreakdownList } from '@/components/reports/reports-breakdown-list';
import { ReportsDailyTable } from '@/components/reports/reports-daily-table';
import {
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SPECIES_EMOJI,
  formatMoney,
  type AppointmentStatus,
  type ClinicReport,
  type PaymentMethod,
} from '@sincvete/shared';

interface ReportsViewProps {
  report: ClinicReport;
  currency?: string;
}

export function ReportsView({ report, currency = 'ARS' }: ReportsViewProps) {
  const operations = report.operations;
  const billing = report.billing;
  const inventory = report.inventory;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Operación, caja e inventario del {report.from} al {report.to}
          </p>
        </div>
        <ReportsPeriodFilter from={report.from} to={report.to} />
      </div>

      {operations && (
        <>
          <ReportsStatGrid
            title="Operación"
            description="Actividad clínica y administrativa del período"
            stats={[
              {
                label: 'Pacientes nuevos',
                value: String(operations.newPatients),
                description: `${operations.newOwners} propietarios`,
                icon: PawPrint,
              },
              {
                label: 'Citas',
                value: String(operations.appointmentsTotal),
                description: `${operations.appointmentsCompleted} completadas · ${operations.appointmentsCancelled} cancel/ausente`,
                icon: Calendar,
              },
              {
                label: 'Consultas',
                value: String(operations.consultationsCompleted),
                description: 'Completadas',
                icon: Stethoscope,
              },
              {
                label: 'Internaciones',
                value: String(operations.hospitalizationsAdmitted),
                description: 'Admisiones',
                icon: BedDouble,
              },
              {
                label: 'Vacunas',
                value: String(operations.vaccinationsRecorded),
                description: 'Dosis registradas',
                icon: Syringe,
              },
              {
                label: 'Cirugías',
                value: String(operations.surgeriesCompleted),
                description: 'Completadas',
                icon: Scissors,
              },
              {
                label: 'Laboratorio',
                value: String(operations.labOrdersCompleted),
                description: 'Órdenes completadas',
                icon: FlaskConical,
              },
              {
                label: 'Propietarios nuevos',
                value: String(operations.newOwners),
                icon: Users,
              },
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportsBreakdownList
              title="Citas por estado"
              items={operations.appointmentsByStatus.map((item) => ({
                label:
                  APPOINTMENT_STATUS_LABELS[item.status as AppointmentStatus] ?? item.status,
                value: String(item.count),
                count: item.count,
              }))}
              emptyLabel="No hay citas en el período."
            />
            <ReportsBreakdownList
              title="Consultas por especie"
              items={operations.consultationsBySpecies.map((item) => ({
                label: `${SPECIES_EMOJI[item.species] ?? ''} ${item.species}`.trim(),
                value: String(item.count),
                count: item.count,
              }))}
              emptyLabel="No hay consultas completadas en el período."
            />
          </div>
        </>
      )}

      {billing && (
        <>
          <ReportsStatGrid
            title="Caja"
            description="Emisión y cobros del período"
            stats={[
              {
                label: 'Facturado',
                value: formatMoney(billing.invoicesIssuedTotal, currency),
                description: `${billing.invoicesIssuedCount} factura${billing.invoicesIssuedCount !== 1 ? 's' : ''}`,
                icon: Receipt,
              },
              {
                label: 'Cobrado',
                value: formatMoney(billing.paymentsTotal, currency),
                description: `${billing.paymentsCount} pago${billing.paymentsCount !== 1 ? 's' : ''}`,
                icon: Receipt,
              },
              {
                label: 'Por cobrar',
                value: formatMoney(billing.openBalance, currency),
                description: 'Saldo actual de facturas emitidas',
                icon: Receipt,
              },
              {
                label: 'Anuladas',
                value: String(billing.invoicesVoidedCount),
                icon: Receipt,
              },
            ]}
          />
          <ReportsBreakdownList
            title="Cobros por medio"
            items={billing.paymentsByMethod.map((item) => ({
              label: PAYMENT_METHOD_LABELS[item.method as PaymentMethod] ?? item.method,
              value: formatMoney(item.amount, currency),
              count: item.count,
            }))}
            emptyLabel="No hay cobros en el período."
          />
        </>
      )}

      {inventory && (
        <ReportsStatGrid
          title="Inventario"
          description="Movimientos del período y stock bajo actual"
          stats={[
            {
              label: 'Stock bajo',
              value: String(inventory.lowStockCount),
              description: 'Productos activos en o bajo el mínimo',
              icon: Package,
            },
            {
              label: 'Entradas',
              value: String(inventory.movementsEntrada),
              icon: Package,
            },
            {
              label: 'Salidas',
              value: String(inventory.movementsSalida),
              icon: Package,
            },
            {
              label: 'Ajustes / descartes',
              value: String(inventory.movementsAjuste + inventory.movementsDescarte),
              description: `${inventory.movementsAjuste} ajustes · ${inventory.movementsDescarte} descartes`,
              icon: Package,
            },
          ]}
        />
      )}

      <ReportsDailyTable
        rows={report.daily}
        showPayments={Boolean(billing)}
        currency={currency}
      />
    </div>
  );
}
