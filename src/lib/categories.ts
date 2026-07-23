// Relative import so scripts/seed-emulator.ts can run this through tsx without aliases.
import type { CategoryType } from '../types/domain';

export interface CategorySeed {
  name: string;
  type: CategoryType;
  icon: string;
}

/** Sensible defaults created on first sign-in. The user can edit or archive them. */
export const defaultCategorySeeds: CategorySeed[] = [
  { name: 'Housing', type: 'expense', icon: 'housing' },
  { name: 'Groceries', type: 'expense', icon: 'groceries' },
  { name: 'Restaurants', type: 'expense', icon: 'restaurants' },
  { name: 'Transportation', type: 'expense', icon: 'transportation' },
  { name: 'Utilities', type: 'expense', icon: 'utilities' },
  { name: 'Health', type: 'expense', icon: 'health' },
  { name: 'Education', type: 'expense', icon: 'education' },
  { name: 'Entertainment', type: 'expense', icon: 'entertainment' },
  { name: 'Subscriptions', type: 'expense', icon: 'subscriptions' },
  { name: 'Personal care', type: 'expense', icon: 'personal-care' },
  { name: 'Gifts', type: 'expense', icon: 'gifts' },
  { name: 'Other', type: 'expense', icon: 'other' },
  { name: 'Salary', type: 'income', icon: 'salary' },
  { name: 'Freelance', type: 'income', icon: 'freelance' },
  { name: 'Interest', type: 'income', icon: 'interest' },
  { name: 'Refund', type: 'income', icon: 'refund' },
  { name: 'Gift', type: 'income', icon: 'gifts' },
  { name: 'Other income', type: 'income', icon: 'other' },
];
