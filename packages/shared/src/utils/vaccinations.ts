import { APP_LOCALE, APP_TIMEZONE } from '../constants';
import {
  VACCINATION_DUE_SOON_DAYS,
  type VaccinationDueStatus,
} from '../constants/vaccinations';

export function todayInAppTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const totalMonths = monthIndex + months;
  const nextYear = year + Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

export function formatVaccinationDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return '—';

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function vaccinationDueStatus(
  nextDueAt: string | null | undefined,
  today: string = todayInAppTimezone()
): VaccinationDueStatus {
  if (!nextDueAt) return 'sin_fecha';
  if (nextDueAt < today) return 'vencida';

  const due = new Date(`${nextDueAt}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= VACCINATION_DUE_SOON_DAYS) return 'por_vencer';
  return 'al_dia';
}
