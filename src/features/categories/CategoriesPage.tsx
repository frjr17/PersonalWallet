import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ChevronRight, Pencil, Plus, Shapes, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { logError, userMessage } from '@/lib/errors';
import type { Category, CategoryType } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { deleteCategory, updateCategory } from '@/services/repositories';
import { CategoryFormDialog } from '@/features/categories/CategoryForm';

/** One category row with its actions; shared by the list and detail pages. */
export function CategoryRow({
  category,
  childCount,
  onEdit,
}: {
  category: Category;
  childCount: number;
  onEdit: () => void;
}) {
  const { uid } = useLedger();
  const navigate = useNavigate();

  async function toggleArchived() {
    try {
      await updateCategory(uid, category.id, { archived: !category.archived });
      toast.success(category.archived ? 'Category restored' : 'Category archived');
    } catch (error) {
      logError('categories', error);
      toast.error(userMessage(error));
    }
  }

  async function remove() {
    try {
      await deleteCategory(uid, category.id);
      toast.success('Category deleted');
    } catch (error) {
      logError('categories', error);
      toast.error(userMessage(error));
    }
  }

  return (
    <li
      className={cn(
        'flex items-center gap-3 border-b border-dashed py-2.5 last:border-b-0',
        category.archived && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => navigate(`/categories/${category.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <CategoryIcon icon={category.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{category.name}</span>
          {childCount > 0 && (
            <span className="block text-xs text-muted-foreground">
              {childCount} subcategor{childCount === 1 ? 'y' : 'ies'}
            </span>
          )}
        </span>
        {category.archived && <Badge variant="secondary">Archived</Badge>}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      <Button variant="ghost" size="icon" aria-label={`Edit ${category.name}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={category.archived ? `Restore ${category.name}` : `Archive ${category.name}`}
        onClick={() => void toggleArchived()}
      >
        {category.archived ? <ArchiveRestore /> : <Archive />}
      </Button>
      <ConfirmDialog
        title={`Delete “${category.name}”?`}
        description="Its subcategories become top-level, transactions keep their history but show as Uncategorized, and budgets on it lose their label. Prefer Archive if the category was ever used."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      >
        <Button variant="ghost" size="icon" aria-label={`Delete ${category.name}`}>
          <Trash2 />
        </Button>
      </ConfirmDialog>
    </li>
  );
}

export function CategoriesPage() {
  const { categories, loading } = useLedger();
  const [tab, setTab] = useState<CategoryType>('expense');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  // Grouped view: only top-level categories here; subcategories live on the
  // category's own page.
  const topLevel = categories.filter(
    (category) => category.type === tab && !category.parentCategoryId,
  );
  const active = topLevel.filter((category) => !category.archived);
  const archived = topLevel.filter((category) => category.archived);
  const childCount = (id: string) =>
    categories.filter((category) => category.parentCategoryId === id).length;

  return (
    <Page
      title="Categories"
      description="How your money is organized — open a category to manage its subcategories."
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
      ) : topLevel.length === 0 ? (
        <EmptyState
          icon={Shapes}
          title="No categories here"
          description="Create a category to start organizing your transactions."
          className="mt-4"
        />
      ) : (
        <>
          <ul className="mt-4">
            {active.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                childCount={childCount(category.id)}
                onEdit={() => {
                  setEditing(category);
                  setFormOpen(true);
                }}
              />
            ))}
          </ul>
          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Archived ({archived.length})
              </summary>
              <ul className="mt-2">
                {archived.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    childCount={childCount(category.id)}
                    onEdit={() => {
                      setEditing(category);
                      setFormOpen(true);
                    }}
                  />
                ))}
              </ul>
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
