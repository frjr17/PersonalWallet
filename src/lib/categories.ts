// Relative import so scripts/seed-emulator.ts can run this through tsx without aliases.
import type { CategoryType } from '../types/domain';

export const MAX_CATEGORY_DEPTH = 4;

interface CategoryNode {
  id: string;
  name: string;
  parentCategoryId?: string;
}

/** 1-based nesting depth. Cycles or missing parents stop the walk safely. */
export function categoryDepth(categories: CategoryNode[], id: string): number {
  let depth = 0;
  let current: CategoryNode | undefined = categories.find((category) => category.id === id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = categories.find((category) => category.id === current!.parentCategoryId);
  }
  return depth;
}

/** Breadcrumb label: "Housing › Utilities › Water". */
export function categoryPath(categories: CategoryNode[], id: string): string {
  const names: string[] = [];
  let current: CategoryNode | undefined = categories.find((category) => category.id === id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = categories.find((category) => category.id === current!.parentCategoryId);
  }
  return names.join(' › ');
}

/** True when `id` sits anywhere under `ancestorId`. */
export function isDescendantOf(
  categories: CategoryNode[],
  id: string,
  ancestorId: string,
): boolean {
  let current: CategoryNode | undefined = categories.find((category) => category.id === id);
  const seen = new Set<string>();
  while (current?.parentCategoryId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentCategoryId === ancestorId) return true;
    current = categories.find((category) => category.id === current!.parentCategoryId);
  }
  return false;
}

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
