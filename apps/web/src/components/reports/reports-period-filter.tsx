'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  REPORT_PERIOD_PRESETS,
  REPORT_PERIOD_PRESET_LABELS,
  getReportPeriod,
} from '@sincvete/shared';

interface ReportsPeriodFilterProps {
  from: string;
  to: string;
}

export function ReportsPeriodFilter({ from, to }: ReportsPeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applyRange = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', nextFrom);
    params.set('to', nextTo);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <form
      className="flex flex-col gap-3 lg:flex-row lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        applyRange(String(form.get('from') ?? from), String(form.get('to') ?? to));
      }}
    >
      <div className="flex flex-wrap gap-2">
        {REPORT_PERIOD_PRESETS.map((preset) => {
          const period = getReportPeriod(preset);
          const active = period.from === from && period.to === to;
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => applyRange(period.from, period.to)}
            >
              {REPORT_PERIOD_PRESET_LABELS[preset]}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
      </div>
    </form>
  );
}
