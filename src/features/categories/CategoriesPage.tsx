import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryIcon, categoryIconNames } from '@/components/categories/CategoryIcon';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { logError, userMessage } from '@/lib/errors';
import { categoryTypeSchema, type Category, type CategoryType } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { createCategory, deleteCategory, updateCategory } from '@/services/repositories';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the category a name'),
  type: categoryTypeSchema,
  icon: z.string().min(1),
  parentCategoryId: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function CategoryFormDialog({
  category,
  defaultType,
  open,
  onOpenChange,
}: {
  category?: Category;
  defaultType: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uid, categories } = useLedger();
  const editing = Boolean(category);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    values: {
      name: category?.name ?? '',
      type: category?.type ?? defaultType,
      icon: category?.icon ?? 'other',
      parentCategoryId: category?.parentCategoryId,
    },
  });
  const type = form.watch('type');
  const icon = form.watch('icon');
  const parents = categories.filter(
    (candidate) =>
      candidate.type === type &&
      !candidate.archived &&
      !candidate.parentCategoryId &&
      candidate.id !== category?.id,
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
        await createCategory(uid, input);
        toast.success('Category created');
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
          <DialogDescription>Categories keep spending and income organized.</DialogDescription>
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
          {!editing && (
            <div className="grid gap-1.5">
              <Label htmlFor="category-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => form.setValue('type', value as CategoryType)}
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
            <div className="flex flex-wrap gap-1.5">
              {categoryIconNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`Icon ${name}`}
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
                    {parent.name}
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

export function CategoriesPage() {
  const { uid, categories, loading } = useLedger();
  const [tab, setTab] = useState<CategoryType>('expense');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  const visible = categories.filter((category) => category.type === tab);
  const active = visible.filter((category) => !category.archived);
  const archived = visible.filter((category) => category.archived);

  async function toggleArchived(category: Category) {
    try {
      await updateCategory(uid, category.id, { archived: !category.archived });
      toast.success(category.archived ? 'Category restored' : 'Category archived');
    } catch (error) {
      logError('categories', error);
      toast.error(userMessage(error));
    }
  }

  async function remove(category: Category) {
    try {
      await deleteCategory(uid, category.id);
      toast.success('Category deleted');
    } catch (error) {
      logError('categories', error);
      toast.error(userMessage(error));
    }
  }

  function row(category: Category) {
    return (
      <li
        key={category.id}
        className={cn(
          'flex items-center gap-3 border-b py-2.5 last:border-b-0',
          category.archived && 'opacity-60',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <CategoryIcon icon={category.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {category.parentCategoryId && (
              <span className="text-muted-foreground">
                {categories.find((parent) => parent.id === category.parentCategoryId)?.name} ›{' '}
              </span>
            )}
            {category.name}
          </span>
        </span>
        {category.archived && <Badge variant="secondary">Archived</Badge>}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${category.name}`}
          onClick={() => {
            setEditing(category);
            setFormOpen(true);
          }}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={category.archived ? `Restore ${category.name}` : `Archive ${category.name}`}
          onClick={() => void toggleArchived(category)}
        >
          {category.archived ? <ArchiveRestore /> : <Archive />}
        </Button>
        <ConfirmDialog
          title={`Delete “${category.name}”?`}
          description="Transactions keep their history but show as Uncategorized, and any budget on this category loses its label. Prefer Archive if the category was ever used."
          confirmLabel="Delete"
          onConfirm={() => void remove(category)}
        >
          <Button variant="ghost" size="icon" aria-label={`Delete ${category.name}`}>
            <Trash2 />
          </Button>
        </ConfirmDialog>
      </li>
    );
  }

  return (
    <Page
      title="Categories"
      description="How your money is organized."
      actions={
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus /> New category
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as CategoryType)}>
        <TabsList aria-label="Category type">
          <TabsTrigger value="expense">Expenses</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
      </Tabs>
      {loading ? (
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Shapes}
          title="No categories here"
          description="Create a category to start organizing your transactions."
          className="mt-4"
        />
      ) : (
        <>
          <ul className="mt-4">{active.map(row)}</ul>
          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Archived ({archived.length})
              </summary>
              <ul className="mt-2">{archived.map(row)}</ul>
            </details>
          )}
        </>
      )}
      <CategoryFormDialog
        category={editing}
        defaultType={tab}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </Page>
  );
}
