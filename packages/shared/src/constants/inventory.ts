export const INVENTORY_PRODUCT_CATEGORIES = [
  'medicamento',
  'vacuna',
  'insumo',
  'alimento',
  'laboratorio',
  'otro',
] as const;

export type InventoryProductCategory = (typeof INVENTORY_PRODUCT_CATEGORIES)[number];

export const INVENTORY_PRODUCT_CATEGORY_LABELS: Record<InventoryProductCategory, string> = {
  medicamento: 'Medicamento',
  vacuna: 'Vacuna',
  insumo: 'Insumo',
  alimento: 'Alimento',
  laboratorio: 'Laboratorio',
  otro: 'Otro',
};

export const INVENTORY_UNITS = [
  'unidad',
  'caja',
  'frasco',
  'ml',
  'mg',
  'g',
  'kg',
  'dosis',
  'otro',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const INVENTORY_UNIT_LABELS: Record<InventoryUnit, string> = {
  unidad: 'Unidad',
  caja: 'Caja',
  frasco: 'Frasco',
  ml: 'ml',
  mg: 'mg',
  g: 'g',
  kg: 'kg',
  dosis: 'Dosis',
  otro: 'Otra',
};

export const INVENTORY_MOVEMENT_TYPES = [
  'entrada',
  'salida',
  'ajuste',
  'descarte',
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  descarte: 'Descarte',
};

export const INVENTORY_MOVEMENT_TYPE_VARIANT: Record<
  InventoryMovementType,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  entrada: 'success',
  salida: 'default',
  ajuste: 'warning',
  descarte: 'destructive',
};

export const INVENTORY_PRODUCT_PRESETS = [
  { name: 'Amoxicilina + Ác. clavulánico', category: 'medicamento' as const, unit: 'caja' as const },
  { name: 'Meloxicam', category: 'medicamento' as const, unit: 'frasco' as const },
  { name: 'Vacuna séxtuple canina', category: 'vacuna' as const, unit: 'dosis' as const },
  { name: 'Vacuna triple felina', category: 'vacuna' as const, unit: 'dosis' as const },
  { name: 'Jeringa 3 ml', category: 'insumo' as const, unit: 'unidad' as const },
  { name: 'Suero fisiológico 500 ml', category: 'insumo' as const, unit: 'unidad' as const },
  { name: 'Alimento renal 2 kg', category: 'alimento' as const, unit: 'unidad' as const },
  { name: 'Tubo EDTA', category: 'laboratorio' as const, unit: 'unidad' as const },
] as const;
