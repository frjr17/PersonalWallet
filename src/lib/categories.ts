import type { Category, CategoryType } from '@/types/domain';

export interface CategoryTreeItem {
  category: Category;
  depth: number;
  path: string;
}

export function flattenCategories(
  categories: readonly Category[],
  options: { type?: CategoryType; includeArchived?: boolean } = {},
): CategoryTreeItem[] {
  const typedCategories = categories.filter(
    (category) => !options.type || category.type === options.type,
  );
  const pool = typedCategories.filter(
    (category) =>
      options.includeArchived ||
      (!category.archived && !categoryHasArchivedAncestor(category, typedCategories)),
  );
  const byId = new Map(pool.map((category) => [category.id, category]));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];
  for (const category of pool) {
    const parentId = category.parentCategoryId;
    if (parentId && byId.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) ?? []), category]);
    } else {
      roots.push(category);
    }
  }
  const sort = (items: Category[]) => items.sort((a, b) => a.name.localeCompare(b.name));
  const result: CategoryTreeItem[] = [];
  const visited = new Set<string>();
  const visit = (category: Category, depth: number, parentPath: string) => {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    const path = parentPath ? `${parentPath} / ${category.name}` : category.name;
    result.push({ category, depth, path });
    for (const child of sort(children.get(category.id) ?? [])) visit(child, depth + 1, path);
  };
  for (const root of sort(roots)) visit(root, 0, '');
  for (const orphan of sort(pool.filter((category) => !visited.has(category.id))))
    visit(orphan, 0, '');
  return result;
}

export function categoryHasArchivedAncestor(category: Category, categories: readonly Category[]) {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let parentId = category.parentCategoryId;
  while (parentId) {
    if (visited.has(parentId)) return true;
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) return false;
    if (parent.archived) return true;
    parentId = parent.parentCategoryId;
  }
  return false;
}
