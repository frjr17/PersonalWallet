import {
  addMonths,
  addWeeks,
  addYears,
  format,
  getDate,
  getDaysInMonth,
  parse,
  setDate,
  startOfMonth,
} from 'date-fns';
import type { RecurrenceFrequency } from '@/types/domain';

/** Month key used by budgets and the dashboard, e.g. "2026-07". */
export function monthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function monthKeyToDate(key: string): Date {
  return parse(key, 'yyyy-MM', new Date());
}

/** Half-open range [start, end) covering one month, for Firestore range queries. */
export function monthRange(key: string): { start: Date; end: Date } {
  const start = startOfMonth(monthKeyToDate(key));
  return { start, end: addMonths(start, 1) };
}

export function formatMonthLabel(key: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    monthKeyToDate(key),
  );
}

export function shiftMonthKey(key: string, months: number): string {
  return monthKey(addMonths(monthKeyToDate(key), months));
}

/**
 * Advance a recurring schedule by one step. Month-end dates stay anchored:
 * an anchorDay of 31 yields Jan 31 → Feb 28 → Mar 31 instead of drifting to the 28th.
 */
export function advanceOccurrence(
  current: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  anchorDay?: number,
): Date {
  switch (frequency) {
    case 'weekly':
      return addWeeks(current, interval);
    case 'biweekly':
      return addWeeks(current, 2 * interval);
    case 'monthly': {
      const next = addMonths(current, interval);
      const day = Math.min(anchorDay ?? getDate(current), getDaysInMonth(next));
      return setDate(next, day);
    }
    case 'yearly':
      return addYears(current, interval);
  }
}

/** Local datetime-input value (yyyy-MM-dd'T'HH:mm) for <input type="datetime-local">. */
export function toDatetimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/** Local date-input value (yyyy-MM-dd) for <input type="date">. */
export function toDateInput(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
