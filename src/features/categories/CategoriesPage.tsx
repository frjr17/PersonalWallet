import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Archive,
  Check,
  ChevronRight,
  CornerDownRight,
  Edit3,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { useData } from '@/app/DataProvider';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/authentication/AuthProvider';
import { flattenCategories } from '@/lib/categories';
import {
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_ICON,
  type CategoryIconId,
} from '@/lib/categoryIcons';
import { archiveCategory, saveCategory, validateCategoryParent } from '@/services/repositories';
import type { Category, CategoryType } from '@/types/domain';

interface CategoryForm {
  name: string;
  type: CategoryType;
  icon: CategoryIconId;
  parentCategoryId: string;
}

type EditorState =
  { mode: 'create'; type: CategoryType } | { mode: 'edit'; category: Category } | null;

export function CategoriesPage() {
  const { categories } = useData();
  const { user } = useAuth();
  const [activeType, setActiveType] = useState<CategoryType>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const editorRevision = useRef(0);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({
    defaultValues: {
      name: '',
      type: 'expense',
      icon: DEFAULT_CATEGORY_ICON,
      parentCategoryId: '',
    },
  });

  const editorType = watch('type');
  const selectedIcon = watch('icon');
  const selectedParent = watch('parentCategoryId');

  const categoriesForTab = useMemo(
    () => categories.filter((category) => category.type === activeType),
    [activeType, categories],
  );
  const visibleRows = useMemo(
    () => flattenCategories(categoriesForTab, { includeArchived: showArchived }),
    [categoriesForTab, showArchived],
  );

  const editingId = editor?.mode === 'edit' ? editor.category.id : undefined;
  const excludedParentIds = useMemo(
    () => (editingId ? descendantIds(categories, editingId) : new Set<string>()),
    [categories, editingId],
  );
  const parentRows = useMemo(
    () =>
      flattenCategories(
        categories.filter(
          (category) =>
            category.type === editorType &&
            !category.archived &&
            category.id !== editingId &&
            !excludedParentIds.has(category.id),
        ),
      ),
    [categories, editorType, editingId, excludedParentIds],
  );

  function changeTab(type: CategoryType) {
    setActiveType(type);
    setEditor(null);
    clearErrors();
  }

  function openCreate(type: CategoryType, parentCategoryId = '') {
    editorRevision.current += 1;
    reset({ name: '', type, icon: DEFAULT_CATEGORY_ICON, parentCategoryId });
    clearErrors();
    setActiveType(type);
    setEditor({ mode: 'create', type });
  }

  function openEdit(category: Category) {
    editorRevision.current += 1;
    reset({
      name: category.name,
      type: category.type,
      icon: category.icon,
      parentCategoryId: category.parentCategoryId ?? '',
    });
    clearErrors();
    setActiveType(category.type);
    setEditor({ mode: 'edit', category });
  }

  function closeEditor() {
    editorRevision.current += 1;
    setEditor(null);
    clearErrors();
  }

  const submit = handleSubmit(async (value) => {
    if (!user || !editor) return;
    const submittedRevision = editorRevision.current;
    const categoryId = editor.mode === 'edit' ? editor.category.id : undefined;
    const parentCategoryId = value.parentCategoryId || undefined;
    const parentProblem = validateCategoryParent(
      categories,
      categoryId,
      parentCategoryId,
      value.type,
    );
    if (parentProblem) {
      setError('parentCategoryId', { message: parentProblem });
      return;
    }

    try {
      await saveCategory(
        user.uid,
        {
          name: value.name.trim(),
          type: value.type,
          icon: value.icon,
          parentCategoryId,
        },
        categoryId,
      );
      toast.success(editor.mode === 'edit' ? 'Category updated' : 'Category created');
      setActiveType(value.type);
      if (editorRevision.current === submittedRevision) closeEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save category');
    }
  });

  async function setArchived(category: Category, archived: boolean) {
    if (!user) return;
    try {
      await archiveCategory(user.uid, category.id, archived);
      if (editor?.mode === 'edit' && editor.category.id === category.id) closeEditor();
      toast.success(archived ? 'Category archived' : 'Category restored');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update category');
    }
  }

  const activeCounts = {
    expense: categories.filter((category) => category.type === 'expense' && !category.archived)
      .length,
    income: categories.filter((category) => category.type === 'income' && !category.archived)
      .length,
  };

  return (
    <Page
      eyebrow="Your category tree"
      title="Categories"
      action={
        <Button onClick={() => openCreate(activeType)}>
          <Plus size={18} />
          New category
        </Button>
      }
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full gap-6 border-b sm:w-auto" aria-label="Category type">
          <TypeTab
            type="expense"
            activeType={activeType}
            count={activeCounts.expense}
            onSelect={changeTab}
          />
          <TypeTab
            type="income"
            activeType={activeType}
            count={activeCounts.income}
            onSelect={changeTab}
          />
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl px-2 text-sm font-semibold sm:self-auto">
          <input
            type="checkbox"
            className="size-4 accent-jade"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className={`grid gap-5 ${editor ? 'lg:grid-cols-[minmax(0,1fr)_25rem]' : ''}`}>
        <section aria-label={`${capitalize(activeType)} category hierarchy`}>
          {visibleRows.length ? (
            <div>
              <div className="flex items-center justify-between pb-4">
                <div>
                  <p className="eyebrow">{activeType} structure</p>
                  <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
                    Add as many levels as you need.
                  </p>
                </div>
              </div>
              <ul className="divide-y border-y" role="tree">
                {visibleRows.map(({ category, depth }) => {
                  const nestedCount = descendantIds(categoriesForTab, category.id).size;
                  return (
                    <li
                      key={category.id}
                      className={`group relative ${category.archived ? 'bg-ink/[.025] opacity-60 dark:bg-white/[.025]' : ''}`}
                      role="treeitem"
                      aria-level={depth + 1}
                    >
                      <div
                        className="flex min-h-[4.5rem] items-center gap-3 py-3 pr-3 sm:pr-4"
                        style={{ paddingLeft: `${Math.min(depth, 8) * 1.25 + 1}rem` }}
                      >
                        {depth > 0 && (
                          <CornerDownRight
                            className="shrink-0 text-ink/25 dark:text-white/25"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                        <span className="grid size-10 shrink-0 place-items-center text-jade dark:text-[#67c7b5]">
                          <CategoryIcon icon={category.icon} size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{category.name}</p>
                          <p className="mt-0.5 text-xs text-ink/50 dark:text-white/50">
                            {category.archived
                              ? 'Archived'
                              : nestedCount
                                ? `${nestedCount} ${nestedCount === 1 ? 'subcategory' : 'subcategories'}`
                                : 'No subcategories'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {!category.archived && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-2 sm:px-3"
                              aria-label={`Add subcategory to ${category.name}`}
                              title="Add subcategory"
                              onClick={() => openCreate(category.type, category.id)}
                            >
                              <Plus size={17} />
                              <span className="hidden xl:inline">Add</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-2 sm:px-3"
                            aria-label={`Edit ${category.name}`}
                            title="Edit category"
                            onClick={() => openEdit(category)}
                          >
                            <Edit3 size={16} />
                            <span className="hidden xl:inline">Edit</span>
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 px-2 sm:px-3"
                                aria-label={`${category.archived ? 'Restore' : 'Archive'} ${category.name}`}
                                title={category.archived ? 'Restore category' : 'Archive category'}
                              >
                                {category.archived ? (
                                  <RotateCcw size={16} />
                                ) : (
                                  <Archive size={16} />
                                )}
                              </Button>
                            }
                            title={`${category.archived ? 'Restore' : 'Archive'} “${category.name}”?`}
                            description={
                              category.archived
                                ? 'This category will be available for new entries again. Its place in the hierarchy is preserved.'
                                : nestedCount
                                  ? `Existing entries keep this category. Its ${nestedCount} nested ${nestedCount === 1 ? 'category is' : 'categories are'} hidden from new entries until this category is restored.`
                                  : 'Existing entries keep this category, but it will no longer appear when adding a new entry.'
                            }
                            onConfirm={() => setArchived(category, !category.archived)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              title={`No ${activeType} categories yet`}
              detail={`Create a ${activeType} category, then add subcategories directly from its row.`}
            />
          )}
        </section>

        {editor && (
          <Card
            className="order-first h-fit rounded-2xl border-0 bg-mist/45 shadow-none lg:order-none lg:sticky lg:top-5 dark:bg-white/[.045]"
            aria-live="polite"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">
                  {editor.mode === 'edit' ? 'Edit category' : 'Build the hierarchy'}
                </p>
                <h2 className="mt-1 font-display text-xl">
                  {editor.mode === 'edit' ? editor.category.name : 'New category'}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-2"
                aria-label="Close category editor"
                onClick={closeEditor}
              >
                <X size={18} />
              </Button>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <input type="hidden" {...register('type')} />
              <fieldset>
                <legend className="label">Entry type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['expense', 'income'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`min-h-11 rounded-xl border px-3 text-sm font-bold capitalize transition ${
                        editorType === type
                          ? 'border-jade bg-jade text-white'
                          : 'bg-white/60 hover:border-jade/50 dark:bg-white/[.04]'
                      }`}
                      aria-pressed={editorType === type}
                      disabled={editor.mode === 'edit'}
                      onClick={() => {
                        setValue('type', type, { shouldDirty: true });
                        setValue('parentCategoryId', '', { shouldDirty: true });
                        clearErrors('parentCategoryId');
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {editor.mode === 'edit' && (
                  <p className="mt-1.5 text-xs text-ink/50 dark:text-white/50">
                    Entry type stays fixed so historical totals remain consistent.
                  </p>
                )}
              </fieldset>

              <Field label="Category name" error={errors.name?.message}>
                <input
                  className="input"
                  autoComplete="off"
                  placeholder="e.g. Coffee"
                  {...register('name', {
                    required: 'Enter a category name',
                    validate: (value) => value.trim().length > 0 || 'Enter a category name',
                  })}
                />
              </Field>

              <fieldset>
                <legend className="label">Icon</legend>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6">
                  {CATEGORY_ICON_OPTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`grid aspect-square min-h-11 place-items-center rounded-xl transition ${
                        selectedIcon === id
                          ? 'bg-jade text-white ring-2 ring-jade ring-offset-2 ring-offset-mist/45 dark:ring-offset-[#151716]'
                          : 'text-ink/65 hover:bg-white/65 hover:text-jade dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white'
                      }`}
                      aria-label={label}
                      aria-pressed={selectedIcon === id}
                      title={label}
                      onClick={() => setValue('icon', id, { shouldDirty: true })}
                    >
                      <CategoryIcon icon={id} size={19} />
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register('icon', { required: true })} />
              </fieldset>

              <fieldset>
                <legend className="label">Place under</legend>
                <p className="mb-2 text-xs text-ink/50 dark:text-white/50">
                  Choose a parent, or keep this at the top level.
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto py-1">
                  <ParentChoice
                    id="category-parent-root"
                    label="Top level"
                    value=""
                    selected={selectedParent === ''}
                    register={register('parentCategoryId')}
                  />
                  {parentRows.map(({ category, depth }) => (
                    <ParentChoice
                      key={category.id}
                      id={`category-parent-${category.id}`}
                      label={category.name}
                      icon={category.icon}
                      value={category.id}
                      depth={depth + 1}
                      selected={selectedParent === category.id}
                      register={register('parentCategoryId')}
                    />
                  ))}
                </div>
                {errors.parentCategoryId?.message && (
                  <p className="mt-1.5 text-sm text-apricot" role="alert">
                    {errors.parentCategoryId.message}
                  </p>
                )}
              </fieldset>

              <div className="flex gap-2 border-t pt-4">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  <Check size={17} />
                  {isSubmitting
                    ? 'Saving…'
                    : editor.mode === 'edit'
                      ? 'Save changes'
                      : 'Create category'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </Page>
  );
}

function TypeTab({
  type,
  activeType,
  count,
  onSelect,
}: {
  type: CategoryType;
  activeType: CategoryType;
  count: number;
  onSelect: (type: CategoryType) => void;
}) {
  const selected = type === activeType;
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`relative flex min-h-11 flex-1 items-center justify-center gap-2 px-1 text-sm font-bold capitalize transition sm:min-w-28 ${
        selected
          ? 'text-ink after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-jade dark:text-white'
          : 'text-ink/55 hover:text-ink dark:text-white/55 dark:hover:text-white'
      }`}
      onClick={() => onSelect(type)}
    >
      {type}
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[.65rem] ${
          selected
            ? 'bg-mist text-ink dark:bg-white/10 dark:text-white'
            : 'bg-ink/5 dark:bg-white/10'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-sm text-apricot" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function ParentChoice({
  id,
  label,
  icon,
  value,
  depth = 0,
  selected,
  register,
}: {
  id: string;
  label: string;
  icon?: CategoryIconId;
  value: string;
  depth?: number;
  selected: boolean;
  register: UseFormRegisterReturn<'parentCategoryId'>;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg pr-2 text-sm transition ${
        selected
          ? 'bg-mist font-semibold text-ink dark:bg-white/15 dark:text-white'
          : 'hover:bg-ink/5'
      }`}
      style={{ paddingLeft: `${Math.min(depth, 7) * 0.85 + 0.65}rem` }}
    >
      <input id={id} type="radio" value={value} className="sr-only" {...register} />
      {depth > 0 && <ChevronRight size={13} className="opacity-35" aria-hidden="true" />}
      <span className="grid size-6 shrink-0 place-items-center text-jade" aria-hidden="true">
        <CategoryIcon icon={icon} size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && <Check size={15} className="text-jade dark:text-white" aria-hidden="true" />}
    </label>
  );
}

function descendantIds(categories: readonly Category[], categoryId: string): Set<string> {
  const result = new Set<string>();
  const visit = (parentId: string) => {
    for (const category of categories) {
      if (category.parentCategoryId !== parentId || result.has(category.id)) continue;
      result.add(category.id);
      visit(category.id);
    }
  };
  visit(categoryId);
  result.delete(categoryId);
  return result;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
