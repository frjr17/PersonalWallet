import { describe, expect, it } from 'vitest';
import { advanceOccurrence, monthKey, monthRange } from '@/lib/dates';
describe('date calculations', () => {
  it('keeps a month-end anchor', () => {
    const feb = advanceOccurrence(new Date(2025, 0, 31), 'monthly', 1, 31);
    expect(monthKey(feb)).toBe('2025-02');
    expect(feb.getDate()).toBe(28);
    const mar = advanceOccurrence(feb, 'monthly', 1, 31);
    expect(mar.getDate()).toBe(31);
  });
  it('creates an exclusive monthly range', () => {
    const range = monthRange(new Date(2025, 6, 12));
    expect(range.start.getDate()).toBe(1);
    expect(range.end.getMonth()).toBe(7);
  });
});
