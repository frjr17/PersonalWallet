import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ArrowDown, ArrowLeftRight, ArrowUp, Search } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { AmountCalculator } from '@/components/forms/AmountCalculator';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { asDate } from '@/lib/dates';
import { flattenCategories } from '@/lib/categories';
import { formatMoney, parseMoney } from '@/lib/money';
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
        <Card>
          <p className="animate-pulse opacity-60">Opening the ledger entry…</p>
        </Card>
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
    >
      <form onSubmit={submit} className="grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <fieldset>
              <legend className="sr-only">Entry type</legend>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map(({ value, label, icon: Icon, tone }) => {
                  const disabled = value === 'transfer' && (activeAccounts.length < 2 || editing);
                  return (
                    <button
                      type="button"
                      key={value}
                      disabled={disabled}
                      aria-pressed={type === value}
                      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        type === value
                          ? tone === 'apricot'
                            ? 'border-apricot bg-apricot text-ink'
                            : tone === 'jade'
                              ? 'border-jade bg-jade text-white'
                              : 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
                          : 'bg-white/55 hover:border-jade/50 dark:bg-white/[.04]'
                      }`}
                      onClick={() => {
                        setValue('type', value, { shouldDirty: true, shouldValidate: true });
                        setCategorySearch('');
                      }}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" {...register('type')} />
              {editing ? (
                <p className="mt-3 text-sm opacity-60">
                  Transfers are linked entries and can only be created from a new entry.
                </p>
              ) : activeAccounts.length < 2 ? (
                <p className="mt-3 text-sm opacity-60">
                  Add a second active account to enable transfers.
                </p>
              ) : null}
            </fieldset>
          </Card>

          <Card>
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
          </Card>

          {type !== 'transfer' && (
            <Card>
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
              <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {categoryChoices.map(({ category, depth, path }) => (
                  <button
                    type="button"
                    key={category.id}
                    aria-pressed={categoryId === category.id}
                    className={`min-h-12 rounded-xl border px-3 py-2 text-left transition-colors ${
                      categoryId === category.id
                        ? 'border-jade bg-jade text-white'
                        : 'bg-white/55 hover:border-jade/50 dark:bg-white/[.04]'
                    }`}
                    onClick={() =>
                      setValue('categoryId', category.id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <span
                      className="block font-semibold"
                      style={{ paddingLeft: `${depth * 0.65}rem` }}
                    >
                      {category.icon !== 'circle' && <span aria-hidden>{category.icon} </span>}
                      {category.name}
                    </span>
                    {depth > 0 && (
                      <span className="mt-0.5 block truncate text-xs opacity-60">{path}</span>
                    )}
                  </button>
                ))}
                {!categoryChoices.length && (
                  <p className="py-6 text-sm opacity-60">No matching active categories.</p>
                )}
              </div>
              <input type="hidden" {...register('categoryId', { required: 'Choose a category' })} />
              {errors.categoryId && <FormError>{errors.categoryId.message}</FormError>}
            </Card>
          )}

          <Card>
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
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="border-jade/25">
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
          </Card>
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
      className={`min-h-16 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        selected
          ? 'border-jade bg-mist text-ink dark:bg-jade dark:text-white'
          : 'bg-white/55 hover:border-jade/50 dark:bg-white/[.04]'
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
