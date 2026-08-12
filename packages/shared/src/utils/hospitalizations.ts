export function hospitalizationStayDays(
  admittedAt: string,
  dischargedAt?: string | null
): number {
  const start = new Date(admittedAt);
  const end = dischargedAt ? new Date(dischargedAt) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;

  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function formatHospitalizationStayDays(
  admittedAt: string,
  dischargedAt?: string | null
): string {
  const days = hospitalizationStayDays(admittedAt, dischargedAt);
  return `Día ${days}`;
}
