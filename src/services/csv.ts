import Papa from 'papaparse';
import { parse } from 'date-fns';
import { parseMoney } from '@/lib/money';
export interface CsvMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  category?: string;
  merchant?: string;
}
export interface NormalizedRow {
  row: number;
  occurredAt: Date;
  description: string;
  amountMinor: number;
  type: 'income' | 'expense';
  merchant?: string;
  categoryName?: string;
  valid: boolean;
  error?: string;
  included: boolean;
  fingerprint?: string;
  duplicate?: boolean;
}
export function parseCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (result.errors.length) throw new Error(result.errors[0]?.message ?? 'CSV could not be parsed');
  return { fields: result.meta.fields ?? [], rows: result.data };
}
export function normalizeRows(
  rows: Record<string, string>[],
  mapping: CsvMapping,
  dateFormat: string,
): NormalizedRow[] {
  return rows.map((row, index) => {
    try {
      const occurredAt = parse(row[mapping.date] ?? '', dateFormat, new Date());
      if (Number.isNaN(occurredAt.getTime())) throw new Error('Invalid date');
      const debit = mapping.debit ? row[mapping.debit] : undefined,
        credit = mapping.credit ? row[mapping.credit] : undefined,
        amount = mapping.amount ? row[mapping.amount] : undefined;
      let type: 'income' | 'expense', raw: string;
      if (debit && Number(debit.replace(/,/g, '')) !== 0) {
        type = 'expense';
        raw = debit;
      } else if (credit && Number(credit.replace(/,/g, '')) !== 0) {
        type = 'income';
        raw = credit;
      } else {
        const numeric = Number((amount ?? '').replace(/,/g, ''));
        type = numeric < 0 ? 'expense' : 'income';
        raw = String(Math.abs(numeric));
      }
      const description = (row[mapping.description] ?? '').trim();
      if (!description) throw new Error('Missing description');
      return {
        row: index + 2,
        occurredAt,
        description,
        amountMinor: parseMoney(raw),
        type,
        merchant: mapping.merchant ? row[mapping.merchant] : undefined,
        categoryName: mapping.category ? row[mapping.category] : undefined,
        valid: true,
        included: true,
      };
    } catch (e) {
      return {
        row: index + 2,
        occurredAt: new Date(),
        description: row[mapping.description] ?? '',
        amountMinor: 0,
        type: 'expense',
        valid: false,
        error: e instanceof Error ? e.message : 'Invalid row',
        included: false,
      };
    }
  });
}
