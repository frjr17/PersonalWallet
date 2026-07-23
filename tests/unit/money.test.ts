import { describe, expect, it } from 'vitest';
import {
  balanceEffect,
  formatMinor,
  formatSignedMinor,
  minorToInputString,
  parseAmountInput,
  sumMinor,
  usageRatio,
} from '@/lib/money';

describe('parseAmountInput', () => {
  it('parses plain decimals into minor units', () => {
    expect(parseAmountInput('12.50')).toBe(1250);
    expect(parseAmountInput('0.05')).toBe(5);
    expect(parseAmountInput('7')).toBe(700);
    expect(parseAmountInput('12.5')).toBe(1250);
  });

  it('tolerates currency symbols, commas and spaces', () => {
    expect(parseAmountInput('$1,234.56')).toBe(123456);
    expect(parseAmountInput(' 1 000 ')).toBe(100000);
  });

  it('rejects invalid input', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
    expect(parseAmountInput('12.345')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('1.2.3')).toBeNull();
  });

  it('never round-trips through binary floats', () => {
    // 0.1 + 0.2 style pitfalls: parse purely from the string.
    expect(parseAmountInput('0.29')).toBe(29);
    expect(parseAmountInput('19.99')).toBe(1999);
  });
});

describe('formatting', () => {
  it('formats minor units as currency', () => {
    expect(formatMinor(1250)).toBe('$12.50');
    expect(formatMinor(0)).toBe('$0.00');
    expect(formatMinor(-4500)).toBe('-$45.00');
  });

  it('formats signed amounts', () => {
    expect(formatSignedMinor(1250)).toBe('+$12.50');
    expect(formatSignedMinor(-1250)).toBe('−$12.50');
    expect(formatSignedMinor(0)).toBe('$0.00');
  });

  it('produces editable input strings', () => {
    expect(minorToInputString(1250)).toBe('12.50');
    expect(minorToInputString(5)).toBe('0.05');
    expect(minorToInputString(-30)).toBe('-0.30');
  });
});

describe('sums and ratios', () => {
  it('sums integers exactly', () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(sumMinor([])).toBe(0);
  });

  it('computes usage ratios without touching stored money', () => {
    expect(usageRatio(8000, 10000)).toBe(0.8);
    expect(usageRatio(15000, 10000)).toBe(1.5);
    expect(usageRatio(100, 0)).toBe(0);
  });
});

describe('balanceEffect', () => {
  it('credits income and debits expenses', () => {
    expect(balanceEffect('income', 500)).toBe(500);
    expect(balanceEffect('expense', 500)).toBe(-500);
  });

  it('debits transfer sources and credits destinations', () => {
    expect(balanceEffect('transfer', 500, 'source')).toBe(-500);
    expect(balanceEffect('transfer', 500, 'destination')).toBe(500);
  });
});
