import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { toDatetimeLocal } from '@/lib/dates';
import { minorToInputString, parseAmountInput } from '@/lib/money';
import { logError, userMessage } from '@/lib/errors';
import type { Transaction, TransactionType } from '@/types/domain';
import { useLedger, useSettings } from '@/app/DataProvider';
import { getTransaction, getTransferPair } from '@/services/repositories';
import {
  createEntry,
  createTransfer,
  deleteTransaction,
  updateEntry,
  updateTransfer,
} from '@/services/finance';

const amountField = z
  .string()
  .refine(
    (value) => (parseAmountInput(value) ?? 0) > 0,
    'Enter an amount greater than zero, like 12.50',
  );

const entryFormSchema = z.object({
  amount: amountField,
  accountId: z.string().min(1, 'Pick an account'),
  categoryId: z.string().optional(),
  occurredAt: z.string().min(1, 'Pick a date'),
  description: z.string(),
  merchant: z.string(),
  notes: z.string(),
  tags: z.string(),
});

const transferFormSchema = z
  .object({
    amount: amountField,
    sourceAccountId: z.string().min(1, 'Pick the source account'),
    destinationAccountId: z.string().min(1, 'Pick the destination account'),
    occurredAt: z.string().min(1, 'Pick a date'),
    description: z.string(),
    notes: z.string(),
  })
  .refine((values) => values.sourceAccountId !== values.destinationAccountId, {
    message: 'A transfer needs two different accounts',
    path: ['destinationAccountId'],
  });

type EntryFormValues = z.infer<typeof entryFormSchema>;
type TransferFormValues = z.infer<typeof transferFormSchema>;

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function TransactionFormPage() {
  const { transactionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { uid, monthTransactions } = useLedger();

  const editing = Boolean(transactionId);
  const duplicateFrom = searchParams.get('from');
  const presetAccount = searchParams.get('account');

  const [type, setType] = useState<TransactionType>(
    (searchParams.get('type') as TransactionType | null) ?? 'expense',
  );
  const [original, setOriginal] = useState<Transaction | null>(null);
  const [transferLegs, setTransferLegs] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState(editing || Boolean(duplicateFrom));

  useEffect(() => {
    const sourceId = transactionId ?? duplicateFrom;
    if (!sourceId) return;
    let cancelled = false;
    (async () => {
      try {
        const cached = monthTransactions.find((txn) => txn.id === sourceId);
        const txn = cached ?? (await getTransaction(uid, sourceId));
        if (cancelled) return;
        setType(txn.type);
        if (txn.type === 'transfer' && txn.transferId) {
          const legs = await getTransferPair(uid, txn.transferId);
          if (!cancelled) setTransferLegs(legs);
        }
        setOriginal(txn);
      } catch (error) {
        logError('transactions', error);
        toast.error(userMessage(error));
        navigate('/transactions', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // monthTransactions intentionally omitted: this loads once per target id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, transactionId, duplicateFrom]);

  async function handleDelete() {
    if (!original) return;
    try {
      await deleteTransaction(uid, original);
      toast.success(original.type === 'transfer' ? 'Transfer deleted' : 'Transaction deleted');
      navigate('/transactions');
    } catch (error) {
      logError('transactions', error);
      toast.error(userMessage(error, 'The transaction was not deleted. Try again.'));
    }
  }

  const title = editing
    ? type === 'transfer'
      ? 'Edit transfer'
      : 'Edit transaction'
    : 'New transaction';

  return (
    <Page
      title={title}
      description={editing ? undefined : 'Record money in, money out, or a move between accounts.'}
      actions={
        editing && original ? (
          <ConfirmDialog
            title={type === 'transfer' ? 'Delete this transfer?' : 'Delete this transaction?'}
            description={
              type === 'transfer'
                ? 'Both sides of the transfer are removed and both account balances are restored.'
                : 'The transaction is removed and the account balance is restored.'
            }
            confirmLabel="Delete"
            onConfirm={() => void handleDelete()}
          >
            <Button variant="outline">
              <Trash2 /> Delete
            </Button>
          </ConfirmDialog>
        ) : undefined
      }
      className="max-w-xl"
    >
      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : (
        <>
          {!editing && (
            <Tabs
              value={type}
              onValueChange={(value) => setType(value as TransactionType)}
              className="mb-5"
            >
              <TabsList aria-label="Transaction type" className="w-full">
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="transfer">Transfer</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {type === 'transfer' ? (
            <TransferForm original={original} legs={transferLegs} />
          ) : (
            <EntryForm
              type={type}
              original={original}
              duplicating={Boolean(duplicateFrom)}
              presetAccount={presetAccount}
            />
          )}
        </>
      )}
    </Page>
  );
}

function EntryForm({
  type,
  original,
  duplicating,
  presetAccount,
}: {
  type: 'income' | 'expense';
  original: Transaction | null;
  duplicating: boolean;
  presetAccount: string | null;
}) {
  const navigate = useNavigate();
  const ledger = useLedger();
  const { settings } = useSettings();
  const { activeAccounts, categories } = ledger;
  const editing = Boolean(original) && !duplicating;

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === type && (!category.archived || category.id === original?.categoryId),
      ),
    [categories, type, original],
  );

  // defaultValues (not reactive `values`): this form mounts only after `original`
  // has loaded, and a reactive clock-based value would reset user input mid-typing.
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      amount: original ? minorToInputString(original.amountMinor) : '',
      accountId: original?.accountId ?? presetAccount ?? activeAccounts[0]?.id ?? '',
      categoryId: original?.categoryId,
      occurredAt: toDatetimeLocal(duplicating || !original ? new Date() : original.occurredAt),
      description: original?.description ?? '',
      merchant: original?.merchant ?? '',
      notes: original?.notes ?? '',
      tags: original?.tags.join(', ') ?? '',
    },
  });

  // Income and expense use different category sets; drop a stale selection on switch.
  const selectedCategoryId = form.watch('categoryId');
  useEffect(() => {
    if (selectedCategoryId && !availableCategories.some((c) => c.id === selectedCategoryId)) {
      form.setValue('categoryId', undefined);
    }
  }, [selectedCategoryId, availableCategories, form]);

  async function onSubmit(values: EntryFormValues) {
    const input = {
      type,
      accountId: values.accountId,
      categoryId: values.categoryId || undefined,
      amountMinor: parseAmountInput(values.amount)!,
      currency: settings.currency,
      merchant: values.merchant.trim() || undefined,
      description: values.description.trim(),
      notes: values.notes.trim() || undefined,
      tags: splitTags(values.tags),
      occurredAt: new Date(values.occurredAt),
    };
    try {
      if (editing && original) {
        await updateEntry(ledger, original, input);
        toast.success('Transaction updated');
      } else {
        await createEntry(ledger, input);
        toast.success(type === 'income' ? 'Income recorded' : 'Expense recorded');
      }
      navigate(-1);
    } catch (error) {
      logError('transactions', error);
      toast.error(userMessage(error, 'The transaction was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-amount">Amount</Label>
        <Input
          id="entry-amount"
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          className="h-12 font-mono text-2xl"
          aria-invalid={Boolean(errors.amount)}
          {...form.register('amount')}
        />
        <FieldError message={errors.amount?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-account">Account</Label>
          <Select
            value={form.watch('accountId')}
            onValueChange={(value) => form.setValue('accountId', value)}
          >
            <SelectTrigger id="entry-account" aria-invalid={Boolean(errors.accountId)}>
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
          <FieldError message={errors.accountId?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-category">Category</Label>
          <Select
            value={form.watch('categoryId') ?? 'none'}
            onValueChange={(value) =>
              form.setValue('categoryId', value === 'none' ? undefined : value)
            }
          >
            <SelectTrigger id="entry-category">
              <SelectValue placeholder="Uncategorized" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Uncategorized</SelectItem>
              {availableCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.parentCategoryId
                    ? `${categories.find((parent) => parent.id === category.parentCategoryId)?.name} › ${category.name}`
                    : category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="datetime-local"
            aria-invalid={Boolean(errors.occurredAt)}
            {...form.register('occurredAt')}
          />
          <FieldError message={errors.occurredAt?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-merchant">
            {type === 'income' ? 'Payer (optional)' : 'Merchant (optional)'}
          </Label>
          <Input id="entry-merchant" autoComplete="off" {...form.register('merchant')} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-description">Description</Label>
        <Input
          id="entry-description"
          autoComplete="off"
          placeholder={type === 'income' ? 'July paycheck' : 'Weekly groceries'}
          {...form.register('description')}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-tags">Tags (optional)</Label>
        <Input
          id="entry-tags"
          autoComplete="off"
          placeholder="vacation, shared"
          aria-describedby="entry-tags-hint"
          {...form.register('tags')}
        />
        <p id="entry-tags-hint" className="text-xs text-muted-foreground">
          Separate tags with commas.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-notes">Notes (optional)</Label>
        <Textarea id="entry-notes" rows={2} {...form.register('notes')} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {editing ? 'Save changes' : type === 'income' ? 'Record income' : 'Record expense'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TransferForm({
  original,
  legs,
}: {
  original: Transaction | null;
  legs: Transaction[] | null;
}) {
  const navigate = useNavigate();
  const ledger = useLedger();
  const { settings } = useSettings();
  const { activeAccounts } = ledger;
  const editing = Boolean(original);
  const sourceLeg = legs?.find((leg) => leg.destinationAccountId);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      amount: sourceLeg ? minorToInputString(sourceLeg.amountMinor) : '',
      sourceAccountId: sourceLeg?.accountId ?? activeAccounts[0]?.id ?? '',
      destinationAccountId: sourceLeg?.destinationAccountId ?? '',
      occurredAt: toDatetimeLocal(sourceLeg ? sourceLeg.occurredAt : new Date()),
      description: sourceLeg?.description.startsWith('Transfer to ')
        ? ''
        : (sourceLeg?.description ?? ''),
      notes: sourceLeg?.notes ?? '',
    },
  });

  async function onSubmit(values: TransferFormValues) {
    const input = {
      sourceAccountId: values.sourceAccountId,
      destinationAccountId: values.destinationAccountId,
      amountMinor: parseAmountInput(values.amount)!,
      currency: settings.currency,
      description: values.description.trim() || undefined,
      notes: values.notes.trim() || undefined,
      occurredAt: new Date(values.occurredAt),
    };
    try {
      if (editing && legs) {
        await updateTransfer(ledger, legs, input);
        toast.success('Transfer updated');
      } else {
        await createTransfer(ledger, input);
        toast.success('Transfer recorded');
      }
      navigate(-1);
    } catch (error) {
      logError('transactions', error);
      toast.error(userMessage(error, 'The transfer was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="transfer-amount">Amount</Label>
        <Input
          id="transfer-amount"
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          className="h-12 font-mono text-2xl"
          aria-invalid={Boolean(errors.amount)}
          {...form.register('amount')}
        />
        <FieldError message={errors.amount?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="transfer-source">From account</Label>
          <Select
            value={form.watch('sourceAccountId')}
            onValueChange={(value) => form.setValue('sourceAccountId', value)}
          >
            <SelectTrigger id="transfer-source" aria-invalid={Boolean(errors.sourceAccountId)}>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.sourceAccountId?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="transfer-destination">To account</Label>
          <Select
            value={form.watch('destinationAccountId')}
            onValueChange={(value) => form.setValue('destinationAccountId', value)}
          >
            <SelectTrigger
              id="transfer-destination"
              aria-invalid={Boolean(errors.destinationAccountId)}
            >
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts
                .filter((account) => account.id !== form.watch('sourceAccountId'))
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.destinationAccountId?.message} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="transfer-date">Date</Label>
        <Input
          id="transfer-date"
          type="datetime-local"
          aria-invalid={Boolean(errors.occurredAt)}
          {...form.register('occurredAt')}
        />
        <FieldError message={errors.occurredAt?.message} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="transfer-description">Description (optional)</Label>
        <Input
          id="transfer-description"
          autoComplete="off"
          placeholder="Monthly savings"
          aria-describedby="transfer-description-hint"
          {...form.register('description')}
        />
        <p id="transfer-description-hint" className="text-xs text-muted-foreground">
          Left empty, it becomes “Transfer to …” and “Transfer from …”.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="transfer-notes">Notes (optional)</Label>
        <Textarea id="transfer-notes" rows={2} {...form.register('notes')} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {editing ? 'Save changes' : 'Record transfer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
