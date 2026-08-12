export const REPORT_PERIOD_PRESETS = [
  'today',
  'week',
  'month',
  'last_30',
] as const;

export type ReportPeriodPreset = (typeof REPORT_PERIOD_PRESETS)[number];

export const REPORT_PERIOD_PRESET_LABELS: Record<ReportPeriodPreset, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  last_30: 'Últimos 30 días',
};

export const REPORT_MAX_RANGE_DAYS = 92;
