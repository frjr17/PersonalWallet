import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney, percentage, sumMinor } from '@/lib/money';
describe('money utilities', () => {
  it('parses decimal input without float arithmetic', () => {
    expect(parseMoney('12.50')).toBe(1250);
    expect(parseMoney('1,234.5')).toBe(123450);
  });
  it('rejects unsafe or malformed input', () => {
    expect(() => parseMoney('-2')).toThrow();
    expect(() => parseMoney('1.001')).toThrow();
  });
  it('formats and sums minor units', () => {
    expect(formatMoney(1250)).toBe('$12.50');
    expect(sumMinor([100, 250, -50])).toBe(300);
  });
  it('calculates stable percentages', () => expect(percentage(1, 3)).toBe(33.33));
});
