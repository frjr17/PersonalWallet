import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import type { Frequency } from '@/types/domain';
import type { Timestamp } from 'firebase/firestore';
export const asDate = (value: Date | Timestamp) => (value instanceof Date ? value : value.toDate());
export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const monthRange = (date: Date) => ({
  start: startOfMonth(date),
  end: addMonths(startOfMonth(date), 1),
});
export function advanceOccurrence(
  date: Date,
  frequency: Frequency,
  interval: number,
  anchorDay = date.getDate(),
): Date {
  if (frequency === 'weekly') return addWeeks(date, interval);
  if (frequency === 'biweekly') return addWeeks(date, interval * 2);
  if (frequency === 'yearly') {
    const candidate = addYears(startOfYear(date), interval);
    const month = date.getMonth();
    const monthStart = addMonths(candidate, month);
    return new Date(
      monthStart.getFullYear(),
      month,
      Math.min(anchorDay, endOfMonth(monthStart).getDate()),
    );
  }
  const monthStart = addMonths(startOfMonth(date), interval);
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    Math.min(anchorDay, endOfMonth(monthStart).getDate()),
  );
}
export function nextUntilValid(
  date: Date,
  frequency: Frequency,
  interval: number,
  anchorDay: number,
  endDate?: Date,
): Date | undefined {
  const next = advanceOccurrence(date, frequency, interval, anchorDay);
  return endDate && next > endOfYear(endDate) && next > endDate ? undefined : next;
}
export { addDays };
