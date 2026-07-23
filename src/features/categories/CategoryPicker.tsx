import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { categoryPath } from '@/lib/categories';
import type { CategoryType } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { CategoryFormDialog } from '@/features/categories/CategoryForm';

const NEW_SENTINEL = '__new-category__';
const NONE_SENTINEL = 'none';

/**
 * Category select with hierarchy labels and a "New category…" entry, so
 * categories can be created without leaving the form.
 */
export function CategoryPicker({
  id,
  type,
  value,
  onChange,
  allowNone = true,
  invalid,
  includeCategoryId,
}: {
  id: string;
  type: CategoryType;
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  allowNone?: boolean;
  invalid?: boolean;
  /** Keep this id selectable even if archived (editing an old transaction). */
  includeCategoryId?: string;
}) {
  const { categories } = useLedger();
  const [createOpen, setCreateOpen] = useState(false);

  const options = categories
    .filter(
      (category) =>
        category.type === type && (!category.archived || category.id === includeCategoryId),
    )
    .map((category) => ({ id: category.id, label: categoryPath(categories, category.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <Select
        value={value ?? NONE_SENTINEL}
        onValueChange={(next) => {
          if (next === NEW_SENTINEL) {
            setCreateOpen(true);
            return;
          }
          onChange(next === NONE_SENTINEL ? undefined : next);
        }}
      >
        <SelectTrigger id={id} aria-invalid={invalid}>
          <SelectValue placeholder={allowNone ? 'Uncategorized' : 'Pick a category'} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE_SENTINEL}>Uncategorized</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
          <SelectItem value={NEW_SENTINEL}>
            <Plus className="size-3.5" /> New category…
          </SelectItem>
        </SelectContent>
      </Select>
      <CategoryFormDialog
        defaultType={type}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChange}
      />
    </>
  );
}
