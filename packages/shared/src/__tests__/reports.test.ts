import { describe, expect, it } from 'vitest';
import { reportRangeSchema } from '../schemas';
import {
  daysBetweenIso,
  getReportPeriod,
  isValidReportRange,
} from '../utils/reports';

describe('getReportPeriod', () => {
  const now = new Date('2026-08-12T18:00:00.000Z'); // 15:00 AR

  it('returns today', () => {
    expect(getReportPeriod('today', now)).toEqual({ from: '2026-08-12', to: '2026-08-12' });
  });

  it('returns ISO week starting Monday', () => {
    const period = getReportPeriod('week', now);
    expect(period.from).toBe('2026-08-10');
    expect(period.to).toBe('2026-08-12');
  });

  it('returns the current month', () => {
    expect(getReportPeriod('month', now)).toEqual({ from: '2026-08-01', to: '2026-08-12' });
  });

  it('returns the last 30 days inclusive', () => {
    expect(getReportPeriod('last_30', now)).toEqual({ from: '2026-07-14', to: '2026-08-12' });
  });
});

describe('report range helpers', () => {
  it('counts inclusive span', () => {
    expect(daysBetweenIso('2026-08-01', '2026-08-12')).toBe(11);
  });

  it('rejects inverted or too-long ranges', () => {
    expect(isValidReportRange('2026-08-12', '2026-08-01')).toBe(false);
    expect(isValidReportRange('2026-01-01', '2026-08-01')).toBe(false);
    expect(isValidReportRange('2026-08-01', '2026-08-12')).toBe(true);
  });
});

describe('reportRangeSchema', () => {
  it('accepts a valid range', () => {
    const result = reportRangeSchema.safeParse({
      from: '2026-08-01',
      to: '2026-08-12',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a range longer than 92 days', () => {
    const result = reportRangeSchema.safeParse({
      from: '2026-01-01',
      to: '2026-08-01',
    });
    expect(result.success).toBe(false);
  });
});
