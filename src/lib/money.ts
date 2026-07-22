export function parseMoney(input: string, fractionDigits = 2): number {
  const normalized = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d*)?$/.test(normalized)) throw new Error('Enter a valid positive amount');
  const [whole = '0', fraction = ''] = normalized.split('.');
  if (fraction.length > fractionDigits)
    throw new Error(`Use at most ${fractionDigits} decimal places`);
  const scale = 10 ** fractionDigits;
  const result = Number(whole) * scale + Number(fraction.padEnd(fractionDigits, '0'));
  if (!Number.isSafeInteger(result) || result <= 0)
    throw new Error('Amount must be greater than zero');
  return result;
}
export function formatMoney(minor: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}
export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => {
    const next = total + value;
    if (!Number.isSafeInteger(next)) throw new Error('Money total exceeds safe range');
    return next;
  }, 0);
}
export function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part * 10_000) / total) / 100;
}
