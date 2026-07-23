import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryIcon, categoryIconGroups } from '@/components/categories/CategoryIcon';
import { cn } from '@/lib/utils';
import { MAX_CATEGORY_DEPTH, categoryDepth, categoryPath, isDescendantOf } from '@/lib/categories';
import { logError, userMessage } from '@/lib/errors';
import { categoryTypeSchema, type Category, type CategoryType } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { createCategory, updateCategory } from '@/services/repositories';

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the category a name'),
  type: categoryTypeSchema,
  icon: z.string().min(1),
  parentCategoryId: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function CategoryFormDialog({
  category,
  defaultType,
  defaultParentId,
  open,
  onOpenChange,
  onCreated,
}: {
  category?: Category;
  defaultType: CategoryType;
  defaultParentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new id after a create — used by pickers to select it. */
  onCreated?: (id: string) => void;
}) {
  const { uid, categories } = useLedger();
  const editing = Boolean(category);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    values: {
      name: category?.name ?? '',
      type: category?.type ?? defaultType,
      icon: category?.icon ?? 'other',
      parentCategoryId: category?.parentCategoryId ?? defaultParentId,
    },
  });
  const type = form.watch('type');
  const icon = form.watch('icon');

  const [iconSearch, setIconSearch] = useState('');
  const visibleGroups = useMemo(() => {
    const needle = iconSearch.trim().toLowerCase();
    return categoryIconGroups
      .map((group) => ({
        label: group.label,
        names: Object.keys(group.icons).filter(
          (name) => !needle || name.includes(needle) || group.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.names.length > 0);
  }, [iconSearch]);

  // Any same-type category can be a parent, up to 4 levels deep — never itself
  // or one of its own descendants.
  const parents = categories.filter(
    (candidate) =>
      candidate.type === type &&
      !candidate.archived &&
      candidate.id !== category?.id &&
      categoryDepth(categories, candidate.id) < MAX_CATEGORY_DEPTH &&
      (!category || !isDescendantOf(categories, candidate.id, category.id)),
  );

  async function onSubmit(values: CategoryFormValues) {
    const input = {
      name: values.name,
      type: values.type,
      icon: values.icon,
      parentCategoryId: values.parentCategoryId || undefined,
    };
    try {
      if (category) {
        await updateCategory(uid, category.id, input);
        toast.success('Category updated');
      } else {
        const id = await createCategory(uid, input);
        toast.success('Category created');
        onCreated?.(id);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      logError('categories', error);
      toast.error(userMessage(error, 'The category was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories keep spending and income organized — nest them up to {MAX_CATEGORY_DEPTH}{' '}
            levels.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          {!editing && !defaultParentId && (
            <div className="grid gap-1.5">
              <Label htmlFor="category-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  form.setValue('type', value as CategoryType);
                  form.setValue('parentCategoryId', undefined);
                }}
              >
                <SelectTrigger id="category-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Icon</legend>
            <Input
              type="search"
              value={iconSearch}
              onChange={(event) => setIconSearch(event.target.value)}
              placeholder="Search icons — groceries, fuel, gym…"
              aria-label="Search icons"
              className="h-8 text-sm"
            />
            <div className="max-h-52 overflow-y-auto rounded-md border p-2">
              {visibleGroups.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No icon matches “{iconSearch}”.
                </p>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group.label} className="mb-2 last:mb-0">
                    <p className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.names.map((name) => (
                        <button
                          key={name}
                          type="button"
                          title={name.replace(/-/g, ' ')}
                          aria-label={`Icon ${name.replace(/-/g, ' ')}`}
                          aria-pressed={icon === name}
                          onClick={() => form.setValue('icon', name)}
                          className={cn(
                            'grid size-9 place-items-center rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                            icon === name
                              ? 'border-primary bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:bg-secondary',
                          )}
                        >
                          <CategoryIcon icon={name} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="category-parent">Parent category</Label>
            <Select
              value={form.watch('parentCategoryId') ?? 'none'}
              onValueChange={(value) =>
                form.setValue('parentCategoryId', value === 'none' ? undefined : value)
              }
            >
              <SelectTrigger id="category-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — top level</SelectItem>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {categoryPath(categories, parent.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? 'Save changes' : 'Create category'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
