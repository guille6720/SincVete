import { APP_LOCALE, APP_TIMEZONE } from '../constants';

export function formatClinicalEntryDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatClinicalEntryDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
