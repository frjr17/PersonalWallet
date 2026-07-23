import { z } from 'zod';

export const accountTypes = [
  'cash',
  'checking',
  'savings',
  'credit-card',
  'investment',
  'loan',
] as const;
export const accountTypeSchema = z.enum(accountTypes);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const transactionTypes = ['income', 'expense', 'transfer'] as const;
export const transactionTypeSchema = z.enum(transactionTypes);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const categoryTypeSchema = z.enum(['income', 'expense']);
export type CategoryType = z.infer<typeof categoryTypeSchema>;

export const transactionSourceSchema = z.enum(['manual', 'csv-import', 'recurring']);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

export const recurrenceFrequencies = ['weekly', 'biweekly', 'monthly', 'yearly'] as const;
export const recurrenceFrequencySchema = z.enum(recurrenceFrequencies);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

/** Positive amount in minor units (integer cents). */
export const amountMinorSchema = z.number().int().positive();
/** Budget period key, e.g. "2026-07". */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the YYYY-MM format');

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  parentCategoryId?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  amountMinor: number;
  currency: string;
  merchant?: string;
  description: string;
  notes?: string;
  tags: string[];
  occurredAt: Date;
  transferId?: string;
  recurringTransactionId?: string;
  source: TransactionSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id: string;
  categoryId: string;
  period: string;
  limitMinor: number;
  warningThreshold: number;
  rollover: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringTransaction {
  id: string;
  type: Exclude<TransactionType, 'transfer'>;
  accountId: string;
  categoryId: string;
  amountMinor: number;
  currency: string;
  description: string;
  frequency: RecurrenceFrequency;
  interval: number;
  nextOccurrence: Date;
  /** Day-of-month the schedule anchors to, so Jan 31 → Feb 28 → Mar 31. */
  anchorDay?: number;
  endDate?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  accountId: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  createdAt: Date;
}

export const weekStartSchema = z.union([z.literal(0), z.literal(1)]);

// Per-field .catch: a settings doc written by an older app version (missing or
// odd fields) degrades field-by-field instead of collapsing to full defaults —
// crucially, a valid categoriesSeeded flag always survives.
export const settingsSchema = z.object({
  currency: z.string().length(3).catch('USD'),
  locale: z.string().min(2).catch('en-US'),
  timeZone: z.string().min(1).catch('America/Panama'),
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: weekStartSchema.catch(1),
  offlineWarningAcknowledged: z.boolean().catch(false),
  categoriesSeeded: z.boolean().catch(false),
});
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  currency: 'USD',
  locale: 'en-US',
  timeZone: 'America/Panama',
  weekStartsOn: 1,
  offlineWarningAcknowledged: false,
  categoriesSeeded: false,
};
