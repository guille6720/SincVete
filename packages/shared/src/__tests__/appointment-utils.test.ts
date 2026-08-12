import { describe, expect, it } from 'vitest';
import {
  computeEndTime,
  formatDateParam,
  fromLocalDateTimeInput,
  getDurationMinutes,
  getWeekDays,
  getWeekStartDate,
  parseDateParam,
} from '../utils/appointments';

describe('appointment utils', () => {
  it('parses date param with fallback', () => {
    expect(parseDateParam('2024-08-15')).toBe('2024-08-15');
    expect(parseDateParam('invalid')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('computes week start on monday', () => {
    expect(getWeekStartDate('2024-08-15')).toBe('2024-08-12');
  });

  it('returns seven week days', () => {
    expect(getWeekDays('2024-08-12')).toHaveLength(7);
    expect(getWeekDays('2024-08-12')[0]).toBe('2024-08-12');
    expect(getWeekDays('2024-08-12')[6]).toBe('2024-08-18');
  });

  it('computes end time from duration', () => {
    const end = computeEndTime('2024-08-15T12:00:00.000Z', 30);
    expect(getDurationMinutes('2024-08-15T12:00:00.000Z', end)).toBe(30);
  });

  it('converts local datetime input to iso', () => {
    const iso = fromLocalDateTimeInput('2024-08-15T09:00');
    expect(iso).toContain('2024-08-15');
  });

  it('formats date param', () => {
    expect(formatDateParam(new Date('2024-08-15T15:00:00.000Z'))).toMatch(/2024/);
  });
});
