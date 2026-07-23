import type { TransactionType } from '@/types/domain';

/**
 * All monetary amounts are integers in minor units (1250 = $12.50).
 * Parsing works on decimal strings — binary floats never touch money.
 */

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Parse user input like "1,234.56" or "$12.5" into minor units. Returns null when invalid. */
export function parseAmountInput(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  const match = AMOUNT_PATTERN.exec(cleaned);
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const minor = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction || '0', 10);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Like parseAmountInput but accepts a leading minus, for opening balances. */
export function parseSignedAmountInput(input: string): number | null {
  const trimmed = input.trim();
  const negative = trimmed.startsWith('-') || trimmed.startsWith('−');
  const minor = parseAmountInput(negative ? trimmed.slice(1) : trimmed);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

/** Format minor units for display, e.g. 1250 → "$12.50". */
export function formatMinor(minor: number, currency = 'USD', locale = 'en-US'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return formatter.format(minorToDecimal(minor));
}

/** Format with an explicit sign: +$12.50 / −$4.00. */
export function formatSignedMinor(minor: number, currency = 'USD', locale = 'en-US'): string {
  const sign = minor > 0 ? '+' : minor < 0 ? '−' : '';
  return sign + formatMinor(Math.abs(minor), currency, locale);
}

/** Exact decimal value for display/chart axes only — never for arithmetic. */
export function minorToDecimal(minor: number): number {
  return minor / 100;
}

/** Decimal string without currency symbol, e.g. 1250 → "12.50". Used for CSV export and form editing. */
export function minorToInputString(minor: number): string {
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${minor < 0 ? '-' : ''}${whole}.${fraction}`;
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Usage ratio (0–1+) for budget bars. Ratio of two integers; not stored as money. */
export function usageRatio(spentMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0;
  return spentMinor / limitMinor;
}

/**
 * Balance effect of a transaction on a given account.
 * Income credits; expenses debit; a transfer debits its source and credits its destination.
 */
export function balanceEffect(
  type: TransactionType,
  amountMinor: number,
  role: 'source' | 'destination' = 'source',
): number {
  switch (type) {
    case 'income':
      return amountMinor;
    case 'expense':
      return -amountMinor;
    case 'transfer':
      return role === 'source' ? -amountMinor : amountMinor;
  }
}
