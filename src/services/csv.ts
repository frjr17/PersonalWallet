import Papa from 'papaparse';
import { format, isValid, parse } from 'date-fns';
import { minorToInputString } from '@/lib/money';
import { legEffect } from '@/lib/ledger';
import type { Account, Category, Transaction } from '@/types/domain';

// --- Export ---

export function transactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const rows = transactions.map((txn) => ({
    date: format(txn.occurredAt, 'yyyy-MM-dd HH:mm'),
    type: txn.type,
    description: txn.description,
    merchant: txn.merchant ?? '',
    category: categories.find((category) => category.id === txn.categoryId)?.name ?? '',
    account: accounts.find((account) => account.id === txn.accountId)?.name ?? '',
    amount: minorToInputString(legEffect(txn)),
    currency: txn.currency,
    tags: txn.tags.join('; '),
    notes: txn.notes ?? '',
  }));
  return Papa.unparse(rows);
}

export function downloadFile(name: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

// --- Import: parsing ---

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        resolve({
          headers: result.meta.fields ?? [],
          rows: result.data,
        });
      },
      error: (error) => reject(error),
    });
  });
}

export const csvDateFormats = [
  'yyyy-MM-dd',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'M/d/yyyy',
  'dd.MM.yyyy',
] as const;
export type CsvDateFormat = (typeof csvDateFormats)[number];

export interface CsvMapping {
  date: string;
  description: string;
  /** One signed amount column… */
  amount: string;
  /** …or separate debit/credit columns. */
  debit: string;
  credit: string;
  category: string;
  merchant: string;
}

export const emptyMapping: CsvMapping = {
  date: '',
  description: '',
  amount: '',
  debit: '',
  credit: '',
  category: '',
  merchant: '',
};

/** Best-effort auto-mapping from common header names. */
export function guessMapping(headers: string[]): CsvMapping {
  const lower = headers.map((header) => header.toLowerCase());
  const find = (...names: string[]) => {
    const index = lower.findIndex((header) => names.some((name) => header.includes(name)));
    return index === -1 ? '' : headers[index]!;
  };
  return {
    date: find('date', 'fecha'),
    description: find('description', 'memo', 'detail', 'concepto', 'narrative'),
    amount: find('amount', 'monto', 'value'),
    debit: find('debit', 'withdrawal', 'débito'),
    credit: find('credit', 'deposit', 'crédito'),
    category: find('category', 'categoría'),
    merchant: find('merchant', 'payee', 'comercio'),
  };
}

/**
 * Parse a CSV money cell into signed minor units.
 * Handles $ € commas, spaces, and (parentheses) negatives. Null when invalid.
 */
export function parseCsvAmount(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^0-9.,-]/g, '');
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  // "1.234,56" (comma decimals) vs "1,234.56": the last separator wins as decimal.
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const minor =
    Number.parseInt(match[1]!, 10) * 100 +
    Number.parseInt((match[2] ?? '').padEnd(2, '0') || '0', 10);
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

export interface NormalizedCsvRow {
  index: number;
  occurredAt?: Date;
  type?: 'income' | 'expense';
  amountMinor?: number;
  description: string;
  merchant?: string;
  categoryId?: string;
  categoryName?: string;
  error?: string;
  fingerprint?: string;
  duplicate?: 'existing' | 'in-file';
  included: boolean;
}

export function normalizeCsvRow(
  raw: Record<string, string>,
  index: number,
  mapping: CsvMapping,
  dateFormat: CsvDateFormat,
  categories: Category[],
): NormalizedCsvRow {
  const description = (mapping.description ? (raw[mapping.description] ?? '') : '').trim();
  const fail = (error: string): NormalizedCsvRow => ({
    index,
    description,
    error,
    included: false,
  });

  const dateText = (raw[mapping.date] ?? '').trim();
  if (!dateText) return fail('Missing date');
  const occurredAt = parse(dateText, dateFormat, new Date());
  if (!isValid(occurredAt)) return fail(`Unreadable date “${dateText}” for format ${dateFormat}`);

  let type: 'income' | 'expense';
  let amountMinor: number;
  if (mapping.amount) {
    const signed = parseCsvAmount(raw[mapping.amount] ?? '');
    if (signed === null || signed === 0)
      return fail(`Unreadable amount “${raw[mapping.amount] ?? ''}”`);
    type = signed > 0 ? 'income' : 'expense';
    amountMinor = Math.abs(signed);
  } else {
    const debit = mapping.debit ? parseCsvAmount(raw[mapping.debit] ?? '') : null;
    const credit = mapping.credit ? parseCsvAmount(raw[mapping.credit] ?? '') : null;
    if (debit && debit !== 0) {
      type = 'expense';
      amountMinor = Math.abs(debit);
    } else if (credit && credit !== 0) {
      type = 'income';
      amountMinor = Math.abs(credit);
    } else {
      return fail('No debit or credit value');
    }
  }

  const categoryName = mapping.category ? (raw[mapping.category] ?? '').trim() : '';
  const category = categoryName
    ? categories.find(
        (candidate) =>
          candidate.type === type &&
          !candidate.archived &&
          candidate.name.toLowerCase() === categoryName.toLowerCase(),
      )
    : undefined;

  return {
    index,
    occurredAt,
    type,
    amountMinor,
    description,
    merchant: mapping.merchant ? (raw[mapping.merchant] ?? '').trim() || undefined : undefined,
    categoryId: category?.id,
    categoryName: categoryName || undefined,
    included: true,
  };
}

// --- Duplicate detection ---

function normalizeDescription(description: string): string {
  return description.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Deterministic fingerprint over normalized values. SHA-256, hex. */
export async function transactionFingerprint(input: {
  accountId: string;
  occurredAt: Date;
  amountMinor: number;
  type: string;
  description: string;
}): Promise<string> {
  const material = [
    input.accountId,
    format(input.occurredAt, 'yyyy-MM-dd'),
    String(input.amountMinor),
    input.type,
    normalizeDescription(input.description),
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Flag rows that look like duplicates — of existing transactions or of earlier
 * rows in the same file. Nothing is discarded; flagged rows start excluded and
 * the user decides.
 */
export async function markDuplicates(
  rows: NormalizedCsvRow[],
  accountId: string,
  existing: Transaction[],
): Promise<NormalizedCsvRow[]> {
  const existingPrints = new Set(
    await Promise.all(
      existing
        .filter((txn) => txn.type !== 'transfer')
        .map((txn) =>
          transactionFingerprint({
            accountId,
            occurredAt: txn.occurredAt,
            amountMinor: txn.amountMinor,
            type: txn.type,
            description: txn.description,
          }),
        ),
    ),
  );
  const seenInFile = new Set<string>();
  const result: NormalizedCsvRow[] = [];
  for (const row of rows) {
    if (row.error || !row.occurredAt || !row.type || !row.amountMinor) {
      result.push(row);
      continue;
    }
    const print = await transactionFingerprint({
      accountId,
      occurredAt: row.occurredAt,
      amountMinor: row.amountMinor,
      type: row.type,
      description: row.description,
    });
    const duplicate = existingPrints.has(print)
      ? ('existing' as const)
      : seenInFile.has(print)
        ? ('in-file' as const)
        : undefined;
    seenInFile.add(print);
    result.push({ ...row, fingerprint: print, duplicate, included: !duplicate });
  }
  return result;
}
