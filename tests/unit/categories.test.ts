import { describe, expect, it } from 'vitest';
import { flattenCategories } from '@/lib/categories';
import { validateCategoryParent } from '@/services/repositories';
import type { Category } from '@/types/domain';

const category = (id: string, name: string, parentCategoryId?: string): Category => ({
  id,
  name,
  type: 'expense',
  icon: 'general',
  parentCategoryId,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('category hierarchy', () => {
  const categories = [
    category('food', 'Food'),
    category('eating-out', 'Eating out', 'food'),
    category('coffee', 'Coffee', 'eating-out'),
  ];

  it('flattens arbitrary nesting with readable paths', () => {
    expect(flattenCategories(categories).map(({ depth, path }) => ({ depth, path }))).toEqual([
      { depth: 0, path: 'Food' },
      { depth: 1, path: 'Food / Eating out' },
      { depth: 2, path: 'Food / Eating out / Coffee' },
    ]);
  });

  it('prevents self-parenting and descendant cycles', () => {
    expect(validateCategoryParent(categories, 'food', 'food')).toMatch(/own parent/i);
    expect(validateCategoryParent(categories, 'food', 'coffee')).toMatch(/loop/i);
    expect(validateCategoryParent(categories, 'coffee', 'food')).toBeNull();
  });

  it('prevents cross-type nesting when a category is created', () => {
    expect(validateCategoryParent(categories, undefined, 'food', 'income')).toMatch(/same type/i);
    expect(validateCategoryParent(categories, undefined, 'food', 'expense')).toBeNull();
  });

  it('hides active descendants of an archived parent from new-entry choices', () => {
    const withArchivedParent = categories.map((item) =>
      item.id === 'food' ? { ...item, archived: true } : item,
    );

    expect(flattenCategories(withArchivedParent)).toEqual([]);
    expect(
      flattenCategories(withArchivedParent, { includeArchived: true }).map(({ path }) => path),
    ).toEqual(['Food', 'Food / Eating out', 'Food / Eating out / Coffee']);
  });
});
