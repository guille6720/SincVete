import {
  PRESCRIPTION_ROUTE_LABELS,
  type PrescriptionRoute,
} from '../constants/pharmacy';

export function formatPrescriptionItemLine(item: {
  medication_name: string;
  dose: string;
  frequency: string;
  duration?: string | null;
  route: PrescriptionRoute;
  instructions?: string | null;
}): string {
  const parts = [
    item.medication_name,
    item.dose,
    item.frequency,
    item.duration,
    PRESCRIPTION_ROUTE_LABELS[item.route],
  ].filter((part): part is string => Boolean(part && part.trim()));

  const line = parts.join(' · ');
  const instructions = item.instructions?.trim();
  return instructions ? `${line}. ${instructions}` : line;
}
