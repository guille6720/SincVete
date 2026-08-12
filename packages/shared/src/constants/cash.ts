export const CASH_SESSION_STATUSES = ['abierta', 'cerrada'] as const;

export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export const CASH_SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
};

export const CASH_SESSION_STATUS_VARIANT: Record<
  CashSessionStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  abierta: 'warning',
  cerrada: 'success',
};

export const CASH_MOVEMENT_KINDS = ['cobro', 'ingreso', 'egreso', 'retiro'] as const;

export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number];

export const CASH_MOVEMENT_KIND_LABELS: Record<CashMovementKind, string> = {
  cobro: 'Cobro',
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  retiro: 'Retiro',
};

export const CASH_MOVEMENT_KIND_VARIANT: Record<
  CashMovementKind,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  cobro: 'success',
  ingreso: 'success',
  egreso: 'destructive',
  retiro: 'warning',
};

export const MANUAL_CASH_MOVEMENT_KINDS = ['ingreso', 'egreso', 'retiro'] as const;

export type ManualCashMovementKind = (typeof MANUAL_CASH_MOVEMENT_KINDS)[number];
