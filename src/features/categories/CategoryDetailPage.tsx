import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { MAX_CATEGORY_DEPTH, categoryDepth, categoryPath } from '@/lib/categories';
import type { Category } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { CategoryFormDialog } from '@/features/categories/CategoryForm';
import { CategoryRow } from '@/features/categories/CategoriesPage';

/** One category's home: breadcrumb, its subcategories, and room to add more. */
export function CategoryDetailPage() {
  const { categoryId = '' } = useParams();
  const navigate = useNavigate();
  const { categories, loading } = useLedger();
  const category = categories.find((candidate) => candidate.id === categoryId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  if (loading) {
    return (
      <Page title="Category">
        <Skeleton className="h-40" />
      </Page>
    );
  }

  if (!category) {
    return (
      <Page title="Category not found">
        <EmptyState
          title="This category does not exist"
          description="It may have been deleted. Head back to your categories."
          action={
            <Button onClick={() => navigate('/categories')}>
              <ArrowLeft /> All categories
            </Button>
          }
        />
      </Page>
    );
  }

  const children = categories.filter((candidate) => candidate.parentCategoryId === category.id);
  const childCount = (id: string) =>
    categories.filter((candidate) => candidate.parentCategoryId === id).length;
  const depth = categoryDepth(categories, category.id);
  const canNest = depth < MAX_CATEGORY_DEPTH;
  const parentLink = category.parentCategoryId
    ? `/categories/${category.parentCategoryId}`
    : '/categories';

  return (
    <Page
      title={category.name}
      description={`${category.type === 'expense' ? 'Expense' : 'Income'} category · level ${depth} of ${MAX_CATEGORY_DEPTH}`}
      actions={
        <>
          <Button variant="outline" onClick={() => navigate(parentLink)}>
            <ArrowLeft /> Up
          </Button>
          {canNest && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> New subcategory
            </Button>
          )}
        </>
      }
    >
      <nav aria-label="Category path" className="mb-4 text-sm text-muted-foreground">
        <Link to="/categories" className="hover:underline">
          Categories
        </Link>
        {' › '}
        {categoryPath(categories, category.id)}
      </nav>

      {children.length === 0 ? (
        <EmptyState
          title="No subcategories"
          description={
            canNest
              ? `Split “${category.name}” into finer buckets when you need more detail.`
              : `This category is at the deepest level (${MAX_CATEGORY_DEPTH}).`
          }
          action={
            canNest ? (
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus /> New subcategory
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul>
          {children.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              childCount={childCount(child.id)}
              onEdit={() => {
                setEditing(child);
                setFormOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      <CategoryFormDialog
        category={editing}
        defaultType={category.type}
        defaultParentId={editing ? undefined : category.id}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </Page>
  );
}
