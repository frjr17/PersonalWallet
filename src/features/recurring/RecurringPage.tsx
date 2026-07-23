import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  CalendarClock,
  Check,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
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
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { CategoryPicker } from '@/features/categories/CategoryPicker';
import { advanceOccurrence, toDateInput } from '@/lib/dates';
import { minorToInputString, parseAmountInput } from '@/lib/money';
import { logError, userMessage } from '@/lib/errors';
import { recurrenceFrequencySchema, type RecurringTransaction } from '@/types/domain';
import { useLedger, useSettings } from '@/app/DataProvider';
import {
  createRecurring,
  deleteRecurring,
  setRecurringActive,
  updateRecurring,
} from '@/services/repositories';
import { confirmRecurring, skipRecurring } from '@/services/finance';

const frequencyLabels = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
} as const;

const recurringFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  accountId: z.string().min(1, 'Pick an account'),
  categoryId: z.string().min(1, 'Pick a category'),
  amount: z
    .string()
    .refine((value) => (parseAmountInput(value) ?? 0) > 0, 'Enter an amount greater than zero'),
  description: z.string().trim().min(1, 'Describe the recurring payment'),
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(36),
  nextOccurrence: z.string().min(1, 'Pick the next date'),
  endDate: z.string(),
});

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

function RecurringFormDialog({
  recurring,
  open,
  onOpenChange,
}: {
  recurring?: RecurringTransaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uid, activeAccounts } = useLedger();
  const { settings } = useSettings();
  const editing = Boolean(recurring);

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    values: {
      type: recurring?.type ?? 'expense',
      accountId: recurring?.accountId ?? activeAccounts[0]?.id ?? '',
      categoryId: recurring?.categoryId ?? '',
      amount: recurring ? minorToInputString(recurring.amountMinor) : '',
      description: recurring?.description ?? '',
      frequency: recurring?.frequency ?? 'monthly',
      interval: recurring?.interval ?? 1,
      nextOccurrence: toDateInput(recurring?.nextOccurrence ?? new Date()),
      endDate: recurring?.endDate ? toDateInput(recurring.endDate) : '',
    },
  });
  const type = form.watch('type');

  async function onSubmit(values: RecurringFormValues) {
    const nextOccurrence = new Date(`${values.nextOccurrence}T09:00`);
    const input = {
      type: values.type,
      accountId: values.accountId,
      categoryId: values.categoryId,
      amountMinor: parseAmountInput(values.amount)!,
      currency: settings.currency,
      description: values.description.trim(),
      frequency: values.frequency,
      interval: values.interval,
      nextOccurrence,
      // Month-end safety: keep the intended day even after short months.
      anchorDay: nextOccurrence.getDate(),
      endDate: values.endDate ? new Date(`${values.endDate}T23:59`) : undefined,
    };
    try {
      if (recurring) {
        await updateRecurring(uid, recurring.id, input);
        toast.success('Recurring transaction updated');
      } else {
        await createRecurring(uid, input);
        toast.success('Recurring transaction created');
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error, 'The recurring transaction was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit recurring' : 'New recurring'}</DialogTitle>
          <DialogDescription>
            Due occurrences appear on the dashboard for you to confirm or skip — nothing posts
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  form.setValue('type', value as 'income' | 'expense');
                  form.setValue('categoryId', '');
                }}
              >
                <SelectTrigger id="recurring-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-amount">Amount</Label>
              <Input
                id="recurring-amount"
                inputMode="decimal"
                placeholder="0.00"
                className="font-mono"
                aria-invalid={Boolean(errors.amount)}
                {...form.register('amount')}
              />
              {errors.amount && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="recurring-description">Description</Label>
            <Input
              id="recurring-description"
              autoComplete="off"
              placeholder={type === 'income' ? 'Monthly salary' : 'Streaming subscription'}
              aria-invalid={Boolean(errors.description)}
              {...form.register('description')}
            />
            {errors.description && (
              <p role="alert" className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-account">Account</Label>
              <Select
                value={form.watch('accountId')}
                onValueChange={(value) => form.setValue('accountId', value)}
              >
                <SelectTrigger id="recurring-account" aria-invalid={Boolean(errors.accountId)}>
                  <SelectValue placeholder="Pick an account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.accountId.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-category">Category</Label>
              <CategoryPicker
                id="recurring-category"
                type={type}
                value={form.watch('categoryId') || undefined}
                onChange={(categoryId) => form.setValue('categoryId', categoryId ?? '')}
                allowNone={false}
                invalid={Boolean(errors.categoryId)}
                includeCategoryId={recurring?.categoryId}
              />
              {errors.categoryId && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.categoryId.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-frequency">Repeats</Label>
              <Select
                value={form.watch('frequency')}
                onValueChange={(value) =>
                  form.setValue('frequency', value as RecurringFormValues['frequency'])
                }
              >
                <SelectTrigger id="recurring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-interval">Every</Label>
              <Input
                id="recurring-interval"
                type="number"
                min={1}
                max={36}
                aria-describedby="recurring-interval-hint"
                {...form.register('interval', { valueAsNumber: true })}
              />
              <p id="recurring-interval-hint" className="text-xs text-muted-foreground">
                1 = every period, 2 = every other, and so on.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-next">Next occurrence</Label>
              <Input
                id="recurring-next"
                type="date"
                aria-invalid={Boolean(errors.nextOccurrence)}
                {...form.register('nextOccurrence')}
              />
              {errors.nextOccurrence && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.nextOccurrence.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-end">Ends (optional)</Label>
              <Input id="recurring-end" type="date" {...form.register('endDate')} />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? 'Save changes' : 'Create recurring'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function upcomingDates(recurring: RecurringTransaction, count: number): Date[] {
  const dates: Date[] = [];
  let current = recurring.nextOccurrence;
  for (let step = 0; step < count; step += 1) {
    if (recurring.endDate && current > recurring.endDate) break;
    dates.push(current);
    current = advanceOccurrence(
      current,
      recurring.frequency,
      recurring.interval,
      recurring.anchorDay,
    );
  }
  return dates;
}

export function RecurringPage() {
  const ledger = useLedger();
  const { uid, recurring, categories, accounts, loading } = ledger;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | undefined>();

  const now = new Date();
  const due = recurring.filter((item) => item.active && item.nextOccurrence <= now);
  const scheduled = recurring.filter((item) => !(item.active && item.nextOccurrence <= now));

  async function confirm(item: RecurringTransaction) {
    try {
      await confirmRecurring(ledger, item);
      toast.success(`Recorded “${item.description}”`);
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error, 'The occurrence was not recorded. Try again.'));
    }
  }

  async function skip(item: RecurringTransaction) {
    try {
      await skipRecurring(uid, item);
      toast.success(`Skipped “${item.description}”`);
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error));
    }
  }

  async function toggleActive(item: RecurringTransaction) {
    try {
      await setRecurringActive(uid, item.id, !item.active);
      toast.success(item.active ? 'Paused' : 'Resumed');
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error));
    }
  }

  async function remove(item: RecurringTransaction) {
    try {
      await deleteRecurring(uid, item.id);
      toast.success('Recurring transaction deleted');
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error));
    }
  }

  function itemRow(item: RecurringTransaction, isDue: boolean) {
    const category = categories.find((candidate) => candidate.id === item.categoryId);
    const account = accounts.find((candidate) => candidate.id === item.accountId);
    return (
      <li
        key={item.id}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-dashed py-3 last:border-b-0"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <CategoryIcon icon={category?.icon} />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-medium">
            {item.description}
            {!item.active && (
              <Badge variant="secondary" className="ml-2">
                Paused
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {frequencyLabels[item.frequency]}
            {item.interval > 1 && ` ×${item.interval}`} · {account?.name} ·{' '}
            {isDue ? (
              `due ${format(item.nextOccurrence, 'MMM d')}`
            ) : (
              <>
                next{' '}
                {upcomingDates(item, 3)
                  .map((date) => format(date, 'MMM d'))
                  .join(', ')}
              </>
            )}
          </p>
        </div>
        <Money
          minor={item.type === 'income' ? item.amountMinor : -item.amountMinor}
          signed
          tone="auto"
          className="ml-auto shrink-0 text-sm font-medium"
        />
        {isDue ? (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" onClick={() => void confirm(item)}>
              <Check /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => void skip(item)}>
              <SkipForward /> Skip
            </Button>
          </div>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${item.description}`}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setEditing(item);
                setFormOpen(true);
              }}
            >
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleActive(item)}>
              {item.active ? (
                <>
                  <Pause /> Pause
                </>
              ) : (
                <>
                  <Play /> Resume
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <RecurringDeleteItem item={item} onDelete={() => void remove(item)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  return (
    <Page
      title="Recurring"
      description="Scheduled income and expenses, confirmed by you."
      actions={
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus /> New recurring
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : recurring.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing recurring yet"
          description="Add rent, salary, or subscriptions once — then confirm each occurrence when it's due."
          action={
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> New recurring
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {due.length > 0 && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle>Due now ({due.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <ul>{due.map((item) => itemRow(item, true))}</ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {scheduled.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Everything is due right now — confirm or skip above.
                </p>
              ) : (
                <ul>{scheduled.map((item) => itemRow(item, false))}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <RecurringFormDialog recurring={editing} open={formOpen} onOpenChange={setFormOpen} />
    </Page>
  );
}

function RecurringDeleteItem({
  item,
  onDelete,
}: {
  item: RecurringTransaction;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
        <Trash2 /> Delete
      </DropdownMenuItem>
      <ConfirmDialog
        title={`Delete “${item.description}”?`}
        description="Future occurrences stop. Transactions already recorded stay in the ledger."
        confirmLabel="Delete"
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onDelete}
      />
    </>
  );
}
