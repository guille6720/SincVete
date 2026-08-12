import type { CashMovementKind } from '../constants/cash';
import type { PaymentMethod } from '../constants/billing';

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeExpectedCash(
  openingAmount: number,
  movements: Array<{ kind: CashMovementKind; method: PaymentMethod; amount: number }>
): number {
  let expected = openingAmount;
  for (const movement of movements) {
    if (
      (movement.kind === 'cobro' || movement.kind === 'ingreso') &&
      movement.method === 'efectivo'
    ) {
      expected += movement.amount;
    } else if (movement.kind === 'egreso' || movement.kind === 'retiro') {
      expected -= movement.amount;
    }
  }
  return money(expected);
}

export function sumMovementsByMethod(
  movements: Array<{ method: PaymentMethod; amount: number; kind: CashMovementKind }>
): Array<{ method: PaymentMethod; amount: number; count: number }> {
  const map = new Map<PaymentMethod, { amount: number; count: number }>();
  for (const movement of movements) {
    if (movement.kind === 'egreso' || movement.kind === 'retiro') continue;
    const current = map.get(movement.method) ?? { amount: 0, count: 0 };
    current.amount = money(current.amount + movement.amount);
    current.count += 1;
    map.set(movement.method, current);
  }
  return [...map.entries()].map(([method, value]) => ({ method, ...value }));
}
