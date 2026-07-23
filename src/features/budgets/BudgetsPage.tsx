import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { MonthSwitcher } from '@/components/month-switcher';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { parseAmountInput, minorToInputString } from '@/lib/money';
import { logError, userMessage } from '@/lib/errors';
import type { Budget } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { deleteBudget, saveBudget } from '@/services/repositories';
import { computeBudgetStatus, type BudgetStatus } from '@/services/budgets';

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Pick a category'),
  limit: z
    .string()
    .refine((value) => (parseAmountInput(value) ?? 0) > 0, 'Enter a limit greater than zero'),
  warningThreshold: z.number().min(0.5).max(1),
  rollover: z.boolean(),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function BudgetFormDialog({
  budget,
  open,
  onOpenChange,
}: {
  budget?: Budget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uid, month, categories, monthBudgets } = useLedger();
  const editing = Boolean(budget);

  const expenseCategories = categories.filter(
    (category) =>
      category.type === 'expense' &&
      !category.archived &&
      // one budget per category per month
      (budget?.categoryId === category.id ||
        !monthBudgets.some((existing) => existing.categoryId === category.id)),
  );

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    values: {
      categoryId: budget?.categoryId ?? '',
      limit: budget ? minorToInputString(budget.limitMinor) : '',
      warningThreshold: budget?.warningThreshold ?? 0.8,
      rollover: budget?.rollover ?? false,
    },
  });

  async function onSubmit(values: BudgetFormValues) {
    try {
      await saveBudget(
        uid,
        {
          categoryId: values.categoryId,
          period: budget?.period ?? month,
          limitMinor: parseAmountInput(values.limit)!,
          warningThreshold: values.warningThreshold,
          rollover: values.rollover,
        },
        budget?.id,
      );
      toast.success(editing ? 'Budget updated' : 'Budget created');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      logError('budgets', error);
      toast.error(userMessage(error, 'The budget was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit budget' : 'New budget'}</DialogTitle>
          <DialogDescription>
            A monthly spending limit for one category. You’ll see a warning as spending approaches
            it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-category">Category</Label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(value) => form.setValue('categoryId', value)}
              disabled={editing}
            >
              <SelectTrigger id="budget-category" aria-invalid={Boolean(errors.categoryId)}>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p role="alert" className="text-xs text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-limit">Monthly limit</Label>
            <Input
              id="budget-limit"
              inputMode="decimal"
              placeholder="400.00"
              className="font-mono"
              aria-invalid={Boolean(errors.limit)}
              {...form.register('limit')}
            />
            {errors.limit && (
              <p role="alert" className="text-xs text-destructive">
                {errors.limit.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-warning">Warn at</Label>
            <Select
              value={String(form.watch('warningThreshold'))}
              onValueChange={(value) => form.setValue('warningThreshold', Number(value))}
            >
              <SelectTrigger id="budget-warning">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50% spent</SelectItem>
                <SelectItem value="0.7">70% spent</SelectItem>
                <SelectItem value="0.8">80% spent</SelectItem>
                <SelectItem value="0.9">90% spent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="budget-rollover">Roll over</Label>
              <p className="text-xs text-muted-foreground">
                Mark this budget as rolling unused money into next month.
              </p>
            </div>
            <Switch
              id="budget-rollover"
              checked={form.watch('rollover')}
              onCheckedChange={(checked) => form.setValue('rollover', checked)}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? 'Save changes' : 'Create budget'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetCard({ status, onEdit }: { status: BudgetStatus; onEdit: () => void }) {
  const { uid, categories } = useLedger();
  const category = categories.find((candidate) => candidate.id === status.budget.categoryId);
  const percent = Math.round(status.ratio * 100);

  async function remove() {
    try {
      await deleteBudget(uid, status.budget.id);
      toast.success('Budget deleted');
    } catch (error) {
      logError('budgets', error);
      toast.error(userMessage(error));
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground">
            <CategoryIcon icon={category?.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{category?.name ?? 'Unknown category'}</p>
            <p className="text-xs text-muted-foreground">
              {percent}% used
              {status.budget.rollover && ' · rolls over'}
            </p>
          </div>
          {status.state === 'warning' && (
            <Badge className="bg-chart-2 text-white">Approaching</Badge>
          )}
          {status.state === 'exceeded' && <Badge variant="destructive">Over budget</Badge>}
          <Button variant="ghost" size="icon" aria-label="Edit budget" onClick={onEdit}>
            <Pencil />
          </Button>
          <ConfirmDialog
            title="Delete this budget?"
            description="The category and its transactions stay; only the monthly limit is removed."
            confirmLabel="Delete"
            onConfirm={() => void remove()}
          >
            <Button variant="ghost" size="icon" aria-label="Delete budget">
              <Trash2 />
            </Button>
          </ConfirmDialog>
        </div>
        <Progress
          value={Math.min(100, percent)}
          aria-label={`${category?.name ?? 'Budget'} usage`}
          indicatorClassName={
            status.state === 'exceeded'
              ? 'bg-expense'
              : status.state === 'warning'
                ? 'bg-chart-2'
                : undefined
          }
        />
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <Money minor={status.spentMinor} /> of <Money minor={status.budget.limitMinor} />
          </span>
          {status.remainingMinor >= 0 ? (
            <span className="text-muted-foreground">
              <Money minor={status.remainingMinor} /> left
            </span>
          ) : (
            <span className="text-expense">
              <Money minor={-status.remainingMinor} /> over
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BudgetsPage() {
  const { monthBudgets, monthTransactions, loading } = useLedger();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();

  const statuses = useMemo(
    () =>
      monthBudgets
        .map((budget) => computeBudgetStatus(budget, monthTransactions))
        .sort((a, b) => b.ratio - a.ratio),
    [monthBudgets, monthTransactions],
  );

  return (
    <Page
      title="Budgets"
      description="Monthly limits per category."
      actions={
        <>
          <MonthSwitcher />
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus /> New budget
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : statuses.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No budgets this month"
          description="Set a limit for a spending category and track how the month is going."
          action={
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> New budget
            </Button>
          }
        />
      ) : (
        <section aria-label="Budgets" className="grid gap-4 sm:grid-cols-2">
          {statuses.map((status) => (
            <BudgetCard
              key={status.budget.id}
              status={status}
              onEdit={() => {
                setEditing(status.budget);
                setFormOpen(true);
              }}
            />
          ))}
        </section>
      )}
      <BudgetFormDialog budget={editing} open={formOpen} onOpenChange={setFormOpen} />
    </Page>
  );
}
