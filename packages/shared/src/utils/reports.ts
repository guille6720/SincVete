import { APP_TIMEZONE } from '../constants';
import {
  REPORT_MAX_RANGE_DAYS,
  type ReportPeriodPreset,
} from '../constants/reports';

export function formatIsoDateInTimeZone(
  date: Date,
  timeZone = APP_TIMEZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfIsoWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysIso(isoDate, offset);
}

export function getReportPeriod(
  preset: ReportPeriodPreset,
  now: Date = new Date()
): { from: string; to: string } {
  const today = formatIsoDateInTimeZone(now);

  if (preset === 'today') {
    return { from: today, to: today };
  }

  if (preset === 'week') {
    return { from: startOfIsoWeek(today), to: today };
  }

  if (preset === 'month') {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  return { from: addDaysIso(today, -29), to: today };
}

export function daysBetweenIso(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86_400_000);
}

export function isValidReportRange(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return false;
  }
  const days = daysBetweenIso(from, to);
  return days >= 0 && days <= REPORT_MAX_RANGE_DAYS;
}
