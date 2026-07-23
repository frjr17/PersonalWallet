import { describe, expect, it } from 'vitest';
import {
  advanceOccurrence,
  formatMonthLabel,
  monthKey,
  monthRange,
  shiftMonthKey,
} from '@/lib/dates';

describe('month keys and ranges', () => {
  it('builds and shifts month keys', () => {
    expect(monthKey(new Date(2026, 6, 23))).toBe('2026-07');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  it('produces a half-open month range', () => {
    const { start, end } = monthRange('2026-02');
    expect(start).toEqual(new Date(2026, 1, 1));
    expect(end).toEqual(new Date(2026, 2, 1));
  });

  it('labels months for humans', () => {
    expect(formatMonthLabel('2026-07')).toBe('July 2026');
  });
});

describe('advanceOccurrence', () => {
  it('advances weekly and biweekly schedules', () => {
    const start = new Date(2026, 0, 5);
    expect(advanceOccurrence(start, 'weekly', 1)).toEqual(new Date(2026, 0, 12));
    expect(advanceOccurrence(start, 'biweekly', 1)).toEqual(new Date(2026, 0, 19));
    expect(advanceOccurrence(start, 'weekly', 3)).toEqual(new Date(2026, 0, 26));
  });

  it('clamps month-end dates instead of overflowing', () => {
    const jan31 = new Date(2026, 0, 31);
    expect(advanceOccurrence(jan31, 'monthly', 1, 31)).toEqual(new Date(2026, 1, 28));
  });

  it('returns to the anchor day after a short month', () => {
    const feb28 = new Date(2026, 1, 28);
    expect(advanceOccurrence(feb28, 'monthly', 1, 31)).toEqual(new Date(2026, 2, 31));
  });

  it('handles leap years for monthly and yearly schedules', () => {
    expect(advanceOccurrence(new Date(2028, 0, 31), 'monthly', 1, 31)).toEqual(
      new Date(2028, 1, 29),
    );
    expect(advanceOccurrence(new Date(2028, 1, 29), 'yearly', 1)).toEqual(new Date(2029, 1, 28));
  });

  it('respects multi-month intervals', () => {
    expect(advanceOccurrence(new Date(2026, 0, 15), 'monthly', 3)).toEqual(new Date(2026, 3, 15));
  });
});
