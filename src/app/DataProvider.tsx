import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { monthKey } from '@/lib/dates';
import {
  subscribeAccounts,
  subscribeBudgets,
  subscribeCategories,
  subscribeMonthTransactions,
  subscribeRecurring,
} from '@/services/repositories';
import type { Account, Budget, Category, RecurringTransaction, Transaction } from '@/types/domain';
import { useAuth } from '@/features/authentication/AuthProvider';
interface DataValue {
  month: Date;
  setMonth: (v: Date) => void;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  loading: boolean;
}
const Context = createContext<DataValue | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date()),
    [accounts, setAccounts] = useState<Account[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [transactions, setTransactions] = useState<Transaction[]>([]),
    [budgets, setBudgets] = useState<Budget[]>([]),
    [recurring, setRecurring] = useState<RecurringTransaction[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = [
      subscribeAccounts(user.uid, setAccounts),
      subscribeCategories(user.uid, setCategories),
      subscribeMonthTransactions(user.uid, month, (v) => {
        setTransactions(v);
        setLoading(false);
      }),
      subscribeBudgets(user.uid, monthKey(month), setBudgets),
      subscribeRecurring(user.uid, setRecurring),
    ];
    return () => unsub.forEach((fn) => fn());
  }, [user, month]);
  const value = useMemo(
    () => ({ month, setMonth, accounts, categories, transactions, budgets, recurring, loading }),
    [month, accounts, categories, transactions, budgets, recurring, loading],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error('DataProvider is missing');
  return value;
}
