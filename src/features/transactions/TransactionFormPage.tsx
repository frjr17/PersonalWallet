import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ArrowDown, ArrowLeftRight, ArrowUp, Check, Search, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AmountCalculator } from '@/components/forms/AmountCalculator';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { asDate } from '@/lib/dates';
import { flattenCategories } from '@/lib/categories';
import { formatMoney, parseMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { accountBalanceView } from '@/services/finance';
import { fingerprint } from '@/services/fingerprint';
import {
  createTransaction,
  createTransfer,
  updateSimpleTransaction,
} from '@/services/repositories';
import type { Account, Transaction, TransactionType } from '@/types/domain';

interface Form {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  amount: string;
  description: string;
  merchant: string;
  occurredAt: string;
  notes: string;
}

const typeOptions = [
  { value: 'expense', label: 'Expense', icon: ArrowDown, tone: 'apricot' },
  { value: 'income', label: 'Income', icon: ArrowUp, tone: 'jade' },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, tone: 'ink' },
] as const;

function formDefaults(source?: Transaction, fallbackAccountId = ''): Form {
  return {
    type: source?.type ?? 'expense',
    accountId: source?.accountId ?? fallbackAccountId,
    destinationAccountId: source?.destinationAccountId ?? '',
    categoryId: source?.categoryId ?? '',
    amount: source ? (source.amountMinor / 100).toFixed(2) : '',
    description: source?.description ?? '',
    merchant: source?.merchant ?? '',
    occurredAt: format(source ? asDate(source.occurredAt) : new Date(), 'yyyy-MM-dd'),
    notes: source?.notes ?? '',
  };
}

function isReadyAmount(value: string) {
  try {
    return parseMoney(value) > 0;
  } catch {
    return false;
  }
}

export function TransactionFormPage() {
  const { transactionId } = useParams();
  const [params] = useSearchParams();
  const { transactions, accounts, categories, loading } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categorySearch, setCategorySearch] = useState('');
  const source = transactions.find(
    (item) => item.id === (transactionId ?? params.get('duplicate')),
  );
  const editing = Boolean(transactionId);
  const activeAccounts = accounts.filter((account) => !account.archived);
  const defaults = formDefaults(source, accounts.find((account) => !account.archived)?.id);
  const lastResetSourceKey = useRef<string | undefined>(undefined);
  const {
    register,
    setValue,
    reset,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ defaultValues: defaults });
  const type = watch('type');
  const amount = watch('amount');
  const accountId = watch('accountId');
  const destinationAccountId = watch('destinationAccountId');
  const categoryId = watch('categoryId');
  const amountReady = isReadyAmount(amount);
  const selectedAccount = activeAccounts.find((account) => account.id === accountId);
  const selectedDestination = activeAccounts.find((account) => account.id === destinationAccountId);
  const selectedCategory = categoryId
    ? flattenCategories(categories, { type: type === 'income' ? 'income' : 'expense' }).find(
        ({ category }) => category.id === categoryId,
      )
    : undefined;
  const amountTone = type === 'income' ? 'bg-jade' : type === 'expense' ? 'bg-apricot' : 'bg-ink';

  useEffect(() => {
    if (!source) return;
    const sourceKey = `${editing ? 'edit' : 'duplicate'}:${source.id}`;
    if (lastResetSourceKey.current === sourceKey) return;
    lastResetSourceKey.current = sourceKey;
    reset(formDefaults(source));
  }, [editing, reset, source]);
  useEffect(() => {
    if (!accountId && activeAccounts[0])
      setValue('accountId', activeAccounts[0].id, { shouldValidate: true });
  }, [accountId, activeAccounts, setValue]);
  useEffect(() => {
    if (type === 'transfer' && activeAccounts.length < 2)
      setValue('type', 'expense', { shouldValidate: true });
  }, [type, activeAccounts.length, setValue]);
  useEffect(() => {
    const selected = categories.find((category) => category.id === categoryId);
    if (selected && selected.type !== type) setValue('categoryId', '');
  }, [type, categoryId, categories, setValue]);

  if (editing && loading) {
    return (
      <Page eyebrow="Edit entry" title="Loading transaction">
        <div className="border-y py-8">
          <p className="animate-pulse opacity-60">Opening the ledger entry…</p>
        </div>
      </Page>
    );
  }

  if (editing && (!source || source.type === 'transfer')) {
    return (
      <Page eyebrow="Edit entry" title="Transaction unavailable">
        <EmptyState
          title={source?.type === 'transfer' ? 'Linked transfer' : 'Transaction not found'}
          detail={
            source?.type === 'transfer'
              ? 'Delete this linked transfer and create it again to change its accounts or amount.'
              : 'This entry is not available in the selected month. Return to transactions and choose an entry there.'
          }
        />
      </Page>
    );
  }

  const categoryChoices = flattenCategories(categories, {
    type: type === 'income' ? 'income' : 'expense',
  }).filter(({ path }) => path.toLowerCase().includes(categorySearch.trim().toLowerCase()));

  const submit = handleSubmit(async (value) => {
    if (!user) return;
    try {
      const amountMinor = parseMoney(value.amount);
      const occurredAt = new Date(`${value.occurredAt}T12:00:00`);
      const hash = await fingerprint(value.accountId, occurredAt, amountMinor, value.description);
      if (value.type === 'transfer') {
        if (editing) throw new Error('Create transfers from a new entry');
        await createTransfer(user.uid, {
          sourceAccountId: value.accountId,
          destinationAccountId: value.destinationAccountId,
          amountMinor,
          currency: 'USD',
          description: value.description.trim(),
          occurredAt,
          fingerprint: hash,
        });
      } else {
        const input = {
          type: value.type,
          accountId: value.accountId,
          categoryId: value.categoryId,
          amountMinor,
          currency: 'USD',
          description: value.description.trim(),
          merchant: value.merchant.trim() || undefined,
          notes: value.notes.trim() || undefined,
          tags: [],
          occurredAt,
          source: 'manual' as const,
          fingerprint: hash,
        };
        if (editing && source) await updateSimpleTransaction(user.uid, source, input);
        else await createTransaction(user.uid, input);
      }
      toast.success(editing ? 'Transaction updated' : 'Transaction saved');
      void navigate('/transactions');
    } catch (error) {
      console.error(
        'Transaction save failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
      toast.error(error instanceof Error ? error.message : 'Could not save transaction');
    }
  });

  return (
    <Page
      eyebrow={editing ? 'Edit entry' : 'New entry'}
      title={
        type === 'transfer' ? 'Move money' : type === 'income' ? 'Record income' : 'Record expense'
      }
      action={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            aria-label="Cancel"
            onClick={() => navigate(-1)}
          >
            <X size={18} />
          </Button>
          <Button
            form="transaction-form"
            disabled={isSubmitting || !amountReady}
            aria-label="Save entry"
          >
            <Check size={18} />
          </Button>
        </div>
      }
    >
      <form
        id="transaction-form"
        onSubmit={submit}
        className="grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]"
      >
        <div className="space-y-6">
          <section
            className={cn('overflow-hidden rounded-[2rem] text-white shadow-lg', amountTone)}
          >
            <fieldset>
              <legend className="sr-only">Entry type</legend>
              <div className="grid grid-cols-3 bg-black/10">
                {typeOptions.map(({ value, label }) => {
                  const disabled = value === 'transfer' && (activeAccounts.length < 2 || editing);
                  return (
                    <button
                      type="button"
                      key={value}
                      disabled={disabled}
                      aria-pressed={type === value}
                      className={cn(
                        'min-h-16 border-x border-black/10 px-2 text-sm font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-35 sm:text-base',
                        type === value ? 'bg-white/12 shadow-inner' : 'hover:bg-white/10',
                      )}
                      onClick={() => {
                        setValue('type', value, { shouldDirty: true, shouldValidate: true });
                        setCategorySearch('');
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" {...register('type')} />
            </fieldset>
            <div className="px-6 py-10 sm:px-10">
              <div className="flex items-end justify-between gap-4">
                <span className="text-5xl font-light">
                  {type === 'income' ? '+' : type === 'expense' ? '−' : ''}
                </span>
                <div className="min-w-0 text-right">
                  <p className="amount truncate text-7xl font-light leading-none sm:text-8xl">
                    {amount || '0'}
                  </p>
                  <p className="mt-2 text-3xl font-light opacity-80">
                    {selectedAccount?.currency ?? 'USD'}
                  </p>
                </div>
              </div>
              <div className="mt-12 grid gap-4 text-center sm:grid-cols-2">
                <div>
                  <p className="text-sm opacity-55">
                    {type === 'transfer' ? 'From account' : 'Account'}
                  </p>
                  <p className="truncate text-xl font-semibold uppercase">
                    {selectedAccount?.name ?? 'Choose account'}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-55">
                    {type === 'transfer' ? 'To account' : 'Category'}
                  </p>
                  <p className="truncate text-xl font-semibold uppercase">
                    {type === 'transfer'
                      ? (selectedDestination?.name ?? 'Choose destination')
                      : (selectedCategory?.path ?? 'Choose category')}
                  </p>
                </div>
              </div>
              {editing ? (
                <p className="mt-6 text-sm opacity-75">
                  Transfers are linked entries and can only be created from a new entry.
                </p>
              ) : activeAccounts.length < 2 ? (
                <p className="mt-6 text-sm opacity-75">
                  Add a second active account to enable transfers.
                </p>
              ) : null}
            </div>
          </section>

          <section className="card">
            <FieldLabel>{type === 'transfer' ? 'From account' : 'Account'}</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeAccounts.map((account) => (
                <AccountChoice
                  key={account.id}
                  account={account}
                  context={type === 'transfer' ? 'From account' : 'Account'}
                  selected={accountId === account.id}
                  onClick={() => {
                    setValue('accountId', account.id, { shouldDirty: true, shouldValidate: true });
                    if (destinationAccountId === account.id)
                      setValue('destinationAccountId', '', { shouldValidate: true });
                  }}
                />
              ))}
            </div>
            <input type="hidden" {...register('accountId', { required: 'Choose an account' })} />
            {errors.accountId && <FormError>{errors.accountId.message}</FormError>}

            {type === 'transfer' && (
              <div className="mt-6 border-t pt-5">
                <FieldLabel>To account</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {activeAccounts.map((account) => (
                    <AccountChoice
                      key={account.id}
                      account={account}
                      context="To account"
                      selected={destinationAccountId === account.id}
                      disabled={account.id === accountId}
                      onClick={() =>
                        setValue('destinationAccountId', account.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  ))}
                </div>
                <input
                  type="hidden"
                  {...register('destinationAccountId', {
                    required: 'Choose a destination account',
                  })}
                />
                {errors.destinationAccountId && (
                  <FormError>{errors.destinationAccountId.message}</FormError>
                )}
              </div>
            )}
          </section>

          {type !== 'transfer' && (
            <section className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <p className="text-sm opacity-55">Subcategories keep their full path visible.</p>
                </div>
                <label className="relative sm:w-64">
                  <span className="sr-only">Search categories</span>
                  <Search
                    className="absolute left-3 top-3 text-ink/40 dark:text-white/40"
                    size={18}
                  />
                  <input
                    className="input pl-9"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Find a category"
                  />
                </label>
              </div>
              <div className="mt-4 grid max-h-72 gap-x-5 overflow-y-auto border-y pr-1 sm:grid-cols-2">
                {categoryChoices.map(({ category, depth, path }) => (
                  <button
                    type="button"
                    key={category.id}
                    aria-pressed={categoryId === category.id}
                    className={`flex min-h-14 items-center gap-3 border-b px-2 py-2 text-left transition-colors ${
                      categoryId === category.id
                        ? 'bg-mist/80 text-ink dark:bg-jade/25 dark:text-white'
                        : 'hover:bg-ink/[.035] dark:hover:bg-white/[.055]'
                    }`}
                    onClick={() =>
                      setValue('categoryId', category.id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center text-jade dark:text-[#67c7b5]"
                      style={{ marginLeft: `${depth * 0.45}rem` }}
                    >
                      <CategoryIcon icon={category.icon} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{category.name}</span>
                      {depth > 0 && (
                        <span className="mt-0.5 block truncate text-xs opacity-60">{path}</span>
                      )}
                    </span>
                  </button>
                ))}
                {!categoryChoices.length && (
                  <p className="py-6 text-sm opacity-60">No matching active categories.</p>
                )}
              </div>
              <input type="hidden" {...register('categoryId', { required: 'Choose a category' })} />
              {errors.categoryId && <FormError>{errors.categoryId.message}</FormError>}
            </section>
          )}

          <section className="card">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <input
                  className="input"
                  autoComplete="off"
                  {...register('description', { required: 'Add a description' })}
                  aria-invalid={Boolean(errors.description)}
                />
                {errors.description && <FormError>{errors.description.message}</FormError>}
              </label>
              <label>
                <FieldLabel>Date</FieldLabel>
                <input
                  className="input"
                  type="date"
                  {...register('occurredAt', { required: true })}
                />
              </label>
              {type !== 'transfer' && (
                <label>
                  <FieldLabel>
                    Merchant <span className="font-normal opacity-50">optional</span>
                  </FieldLabel>
                  <input className="input" {...register('merchant')} />
                </label>
              )}
              <label className="sm:col-span-2">
                <FieldLabel>
                  Notes <span className="font-normal opacity-50">optional</span>
                </FieldLabel>
                <textarea className="input min-h-24 py-3" {...register('notes')} />
              </label>
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <aside className="rounded-[2rem] bg-[#141615] p-4 text-white shadow-lg dark:bg-white/[.06]">
            <div className="mb-4">
              <FieldLabel>Amount</FieldLabel>
              <p className="text-sm opacity-55">Calculate here, then save the final result.</p>
            </div>
            <AmountCalculator
              value={amount}
              onChange={(next) =>
                setValue('amount', next, { shouldDirty: true, shouldValidate: true })
              }
            />
            <input type="hidden" {...register('amount', { required: 'Enter an amount' })} />
            {errors.amount && <FormError>{errors.amount.message}</FormError>}
            {!amountReady && (
              <p className="mt-2 text-sm opacity-60">Enter an amount or press = to finish.</p>
            )}
            <div className="mt-5 grid gap-2">
              <Button disabled={isSubmitting || !amountReady} className="w-full">
                {isSubmitting ? 'Saving…' : editing ? 'Update entry' : 'Save entry'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </Page>
  );
}

function AccountChoice({
  account,
  context,
  selected,
  disabled,
  onClick,
}: {
  account: Account;
  context: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const view = accountBalanceView(account);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${context}: ${account.name}`}
      aria-pressed={selected}
      className={`min-h-16 rounded-xl px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        selected
          ? 'bg-mist text-ink ring-2 ring-jade/40 dark:bg-jade/25 dark:text-white'
          : 'hover:bg-ink/[.035] dark:hover:bg-white/[.055]'
      }`}
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{account.name}</span>
        <span className="text-xs opacity-55">
          {account.type === 'credit-card' ? 'credit' : account.type}
        </span>
      </span>
      <span className="amount mt-1 block text-sm opacity-70">
        {account.type === 'credit-card'
          ? `${view.label}: ${formatMoney(view.primaryMinor)}`
          : formatMoney(view.primaryMinor)}
      </span>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="mt-1 block text-sm font-semibold text-apricot">
      {children}
    </span>
  );
}
