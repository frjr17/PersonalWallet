/**
 * Stable semantic identifiers persisted with categories.
 *
 * The UI owns the concrete icon component for each identifier. Keeping Firestore
 * values semantic and constrained prevents library-specific component names (or
 * arbitrary user input) from becoming part of the backup format.
 */
export const CATEGORY_ICON_IDS = [
  'general',
  'home',
  'groceries',
  'dining',
  'transport',
  'utilities',
  'health',
  'education',
  'entertainment',
  'subscriptions',
  'personal-care',
  'gift',
  'salary',
  'freelance',
  'interest',
  'refund',
  'shopping',
  'travel',
  'pets',
  'insurance',
  'taxes',
  'debt',
  'childcare',
  'sports',
] as const;

export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIconId = 'general';

export const CATEGORY_ICON_LABELS: Readonly<Record<CategoryIconId, string>> = {
  general: 'General',
  home: 'Home',
  groceries: 'Groceries',
  dining: 'Dining',
  transport: 'Transport',
  utilities: 'Utilities',
  health: 'Health',
  education: 'Education',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  'personal-care': 'Personal care',
  gift: 'Gifts',
  salary: 'Salary',
  freelance: 'Freelance',
  interest: 'Interest',
  refund: 'Refunds',
  shopping: 'Shopping',
  travel: 'Travel',
  pets: 'Pets',
  insurance: 'Insurance',
  taxes: 'Taxes',
  debt: 'Debt',
  childcare: 'Childcare',
  sports: 'Sports',
};

export const CATEGORY_ICON_OPTIONS: ReadonlyArray<{
  id: CategoryIconId;
  label: string;
}> = CATEGORY_ICON_IDS.map((id) => ({ id, label: CATEGORY_ICON_LABELS[id] }));

const categoryIconIds = new Set<string>(CATEGORY_ICON_IDS);

const legacyCategoryIcons: Readonly<Record<string, CategoryIconId>> = {
  circle: 'general',
  '•': 'general',
  '🏠': 'home',
  '🛒': 'shopping',
  '🍽': 'dining',
  '🍽️': 'dining',
  '🚗': 'transport',
  '💡': 'utilities',
  '🩺': 'health',
  '🎓': 'education',
  '🎬': 'entertainment',
  '👛': 'salary',
  '💼': 'freelance',
  '🎁': 'gift',
};

export function isCategoryIconId(value: unknown): value is CategoryIconId {
  return typeof value === 'string' && categoryIconIds.has(value);
}

/** Converts legacy icon values at read/restore boundaries without breaking v1 data. */
export function normalizeCategoryIcon(value: unknown): CategoryIconId {
  if (isCategoryIconId(value)) return value;
  if (typeof value !== 'string') return DEFAULT_CATEGORY_ICON;
  const normalized = value.trim();
  if (isCategoryIconId(normalized)) return normalized;
  return legacyCategoryIcons[normalized] ?? DEFAULT_CATEGORY_ICON;
}
