import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { monthKey, monthRange } from '@/lib/dates';
import { defaultSettings, settingsSchema, type Settings } from '@/types/domain';
import type { Account, Budget, Category, RecurringTransaction, Transaction } from '@/types/domain';
import { logError } from '@/lib/errors';
import { useOwner } from '@/features/authentication/AuthProvider';
import {
  accountsCol,
  budgetsCol,
  categoriesCol,
  ensureDefaultData,
  parseAccount,
  parseBudget,
  parseCategory,
  parseRecurring,
  parseTransaction,
  recurringCol,
  saveSettings,
  settingsDoc,
  transactionsInRange,
} from '@/services/repositories';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

interface LedgerContextValue {
  uid: string;
  month: string;
  setMonth: (key: string) => void;
  accounts: Account[];
  activeAccounts: Account[];
  categories: Category[];
  monthTransactions: Transaction[];
  monthBudgets: Budget[];
  recurring: RecurringTransaction[];
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const LedgerContext = createContext<LedgerContextValue | null>(null);

function reportSyncError(scope: string) {
  return (error: unknown) => {
    logError(scope, error);
    toast.error('Sync problem — some data may be stale. Check your connection.', {
      id: 'sync-error',
    });
  };
}

/**
 * One bounded listener per collection for the selected month.
 * Dashboard, budgets and reports all derive from this snapshot in memory
 * instead of issuing their own Firestore queries.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const user = useOwner();
  const uid = user.uid;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[] | null>(null);
  const [monthBudgets, setMonthBudgets] = useState<Budget[] | null>(null);
  const [recurring, setRecurring] = useState<RecurringTransaction[] | null>(null);

  useEffect(() => {
    return onSnapshot(
      settingsDoc(uid),
      (snap) => {
        const parsed = snap.exists() ? settingsSchema.safeParse(snap.data()) : null;
        const next = parsed?.success ? parsed.data : defaultSettings;
        setSettings(next);
        // First run: seed default categories once, then flip the flag.
        if (!next.categoriesSeeded) {
          ensureDefaultData(uid, next).catch(reportSyncError('seed'));
        }
      },
      reportSyncError('settings'),
    );
  }, [uid]);

  useEffect(() => {
    return onSnapshot(
      query(accountsCol(uid), orderBy('name')),
      (snap) => setAccounts(snap.docs.map(parseAccount)),
      reportSyncError('accounts'),
    );
  }, [uid]);

  useEffect(() => {
    return onSnapshot(
      query(categoriesCol(uid), orderBy('name')),
      (snap) => setCategories(snap.docs.map(parseCategory)),
      reportSyncError('categories'),
    );
  }, [uid]);

  useEffect(() => {
    const { start, end } = monthRange(month);
    return onSnapshot(
      transactionsInRange(uid, start, end),
      (snap) => setMonthTransactions(snap.docs.map(parseTransaction)),
      reportSyncError('transactions'),
    );
  }, [uid, month]);

  useEffect(() => {
    return onSnapshot(
      query(budgetsCol(uid), where('period', '==', month)),
      (snap) => setMonthBudgets(snap.docs.map(parseBudget)),
      reportSyncError('budgets'),
    );
  }, [uid, month]);

  useEffect(() => {
    return onSnapshot(
      query(recurringCol(uid), orderBy('nextOccurrence')),
      (snap) => setRecurring(snap.docs.map(parseRecurring)),
      reportSyncError('recurring'),
    );
  }, [uid]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => saveSettings(uid, patch),
    [uid],
  );

  const settingsValue = useMemo(
    () => ({ settings: settings ?? defaultSettings, updateSettings }),
    [settings, updateSettings],
  );

  const ledgerValue = useMemo<LedgerContextValue>(
    () => ({
      uid,
      month,
      setMonth,
      accounts: accounts ?? [],
      activeAccounts: (accounts ?? []).filter((account) => !account.archived),
      categories: categories ?? [],
      monthTransactions: monthTransactions ?? [],
      monthBudgets: monthBudgets ?? [],
      recurring: recurring ?? [],
      loading:
        accounts === null ||
        categories === null ||
        monthTransactions === null ||
        monthBudgets === null ||
        recurring === null,
    }),
    [uid, month, accounts, categories, monthTransactions, monthBudgets, recurring],
  );

  return (
    <SettingsContext.Provider value={settingsValue}>
      <LedgerContext.Provider value={ledgerValue}>{children}</LedgerContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings requires DataProvider');
  return context;
}

/** Settings with defaults when rendered outside DataProvider (e.g. login screen). */
export function useSettingsOptional(): Settings {
  return useContext(SettingsContext)?.settings ?? defaultSettings;
}

export function useLedger(): LedgerContextValue {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('useLedger requires DataProvider');
  return context;
}
