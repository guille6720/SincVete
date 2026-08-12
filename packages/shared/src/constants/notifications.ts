export const NOTIFICATION_KINDS = [
  'cita',
  'laboratorio',
  'stock',
  'internacion',
  'factura',
  'receta',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  cita: 'Cita',
  laboratorio: 'Laboratorio',
  stock: 'Stock',
  internacion: 'Internación',
  factura: 'Factura',
  receta: 'Receta',
};

export const NOTIFICATION_KIND_VARIANT: Record<
  NotificationKind,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  cita: 'default',
  laboratorio: 'success',
  stock: 'warning',
  internacion: 'destructive',
  factura: 'warning',
  receta: 'default',
};

export const NOTIFICATION_RELATED_TYPES = [
  'appointment',
  'lab_order',
  'inventory_product',
  'hospitalization',
  'invoice',
  'prescription',
] as const;

export type NotificationRelatedType = (typeof NOTIFICATION_RELATED_TYPES)[number];
