'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateParam, formatDayLabel, formatWeekdayLabel, getWeekDays, getWeekStartDate } from '@sincvete/shared';

interface AppointmentsWeekNavProps {
  weekStart: string;
  selectedDate: string;
  countsByDay: Record<string, number>;
}

function shiftWeek(weekStart: string, weeks: number): string {
  const [year, month, day] = weekStart.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function AppointmentsWeekNav({
  weekStart,
  selectedDate,
  countsByDay,
}: AppointmentsWeekNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const weekDays = getWeekDays(weekStart);
  const today = formatDateParam(new Date());

  const navigate = (date: string, week?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    if (week) params.set('week', week);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(selectedDate, shiftWeek(weekStart, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(today, getWeekStartDate(today))}>
            Hoy
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(selectedDate, shiftWeek(weekStart, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const isSelected = day === selectedDate;
          const isToday = day === today;
          const count = countsByDay[day] ?? 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => navigate(day, weekStart)}
              className={cn(
                'rounded-lg border px-2 py-3 text-center transition-colors hover:bg-accent',
                isSelected && 'border-primary bg-primary/5',
                isToday && !isSelected && 'border-primary/40'
              )}
            >
              <p className="text-xs uppercase text-muted-foreground">{formatWeekdayLabel(day)}</p>
              <p className="text-sm font-semibold">{formatDayLabel(day)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count} cita{count !== 1 ? 's' : ''}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
