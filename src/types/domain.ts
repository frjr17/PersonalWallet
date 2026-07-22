import type { Timestamp } from 'firebase/firestore';
import type { CategoryIconId } from '@/lib/categoryIcons';
export type DateValue = Date | Timestamp;
export interface Audited {
  id: string;
  createdAt: DateValue;
  updatedAt: DateValue;
}
export type AccountType = 'cash' | 'checking' | 'savings' | 'credit-card' | 'investment' | 'loan';
export interface Account extends Audited {
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  creditLimitMinor?: number;
  archived: boolean;
}
export type CategoryType = 'income' | 'expense';
export interface Category extends Audited {
  name: string;
  type: CategoryType;
  /** Stable semantic ID; legacy or missing stored values normalize to `general` on read. */
  icon: CategoryIconId;
  parentCategoryId?: string;
  archived: boolean;
}
export type TransactionType = 'income' | 'expense' | 'transfer';
export interface Transaction extends Audited {
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
  occurredAt: DateValue;
  transferId?: string;
  transferRole?: 'source' | 'destination';
  recurringTransactionId?: string;
  source: 'manual' | 'csv-import' | 'recurring';
  fingerprint: string;
}
export interface Budget extends Audited {
  categoryId: string;
  period: string;
  limitMinor: number;
  warningThreshold: number;
  rollover: boolean;
}
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export interface RecurringTransaction extends Audited {
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  amountMinor: number;
  currency: string;
  description: string;
  frequency: Frequency;
  interval: number;
  nextOccurrence: DateValue;
  scheduleAnchorDay: number;
  endDate?: DateValue;
  active: boolean;
}
export interface ProfileSettings {
  currency: string;
  locale: string;
  timeZone: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  theme: 'light' | 'dark' | 'system';
}
export interface ImportRecord extends Audited {
  fileName: string;
  accountId: string;
  imported: number;
  skipped: number;
  duplicates: number;
}
export const defaultSettings: ProfileSettings = {
  currency: 'USD',
  locale: 'en-US',
  timeZone: 'America/Panama',
  weekStartsOn: 1,
  theme: 'system',
};
