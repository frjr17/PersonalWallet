import { Banknote, CreditCard, HandCoins, Landmark, PiggyBank, TrendingUp } from 'lucide-react';
import type { AccountType } from '@/types/domain';

export const accountTypeMeta: Record<
  AccountType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  cash: { label: 'Cash', icon: Banknote },
  checking: { label: 'Checking', icon: Landmark },
  savings: { label: 'Savings', icon: PiggyBank },
  'credit-card': { label: 'Credit card', icon: CreditCard },
  investment: { label: 'Investment', icon: TrendingUp },
  loan: { label: 'Loan', icon: HandCoins },
};
