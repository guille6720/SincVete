import { APP_LOCALE } from '../constants';

export function formatMoney(value: number, currency = 'ARS'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
