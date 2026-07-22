import { useState } from 'react';
import {
  Archive,
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { archiveAccount, saveAccount } from '@/services/repositories';
import { accountBalanceView } from '@/services/finance';
import { formatMoney, parseMoney } from '@/lib/money';
import type { Account, AccountType } from '@/types/domain';

interface Form {
  name: string;
  type: AccountType;
  openingBalance: string;
  creditLimit: string;
}

const accountTypes = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'checking', label: 'Checking', icon: Landmark },
  { value: 'savings', label: 'Savings', icon: PiggyBank },
  { value: 'credit-card', label: 'Credit card', icon: CreditCard },
  { value: 'investment', label: 'Investment', icon: TrendingUp },
  { value: 'loan', label: 'Loan', icon: WalletCards },
] as const;

function parseStartingAmount(value: string) {
  return /^(?:0+(?:\.0*)?|\.0+)?$/.test(value.trim()) || value.trim() === ''
    ? 0
    : parseMoney(value);
}

function editableOpening(account: Account) {
  const value =
    account.type === 'credit-card'
      ? Math.abs(account.openingBalanceMinor)
      : account.openingBalanceMinor;
  return (value / 100).toFixed(2);
}

export function AccountsPage() {
  const { accounts } = useData();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [pendingArchiveId, setPendingArchiveId] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    defaultValues: { type: 'checking', openingBalance: '0.00', creditLimit: '' },
  });
  const selectedType = watch('type');

  const openCreate = () => {
    setEditingId(undefined);
    reset({ name: '', type: 'checking', openingBalance: '0.00', creditLimit: '' });
    setShow(true);
  };
  const openEdit = (account: Account) => {
    setEditingId(account.id);
    reset({
      name: account.name,
      type: account.type,
      openingBalance: editableOpening(account),
      creditLimit:
        account.creditLimitMinor === undefined ? '' : (account.creditLimitMinor / 100).toFixed(2),
    });
    setShow(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = handleSubmit(async (value) => {
    if (!user) return;
    try {
      const accountType = editingId
        ? (accounts.find((account) => account.id === editingId)?.type ?? value.type)
        : value.type;
      const enteredOpening = parseStartingAmount(value.openingBalance);
      await saveAccount(
        user.uid,
        {
          name: value.name.trim(),
          type: accountType,
          currency: 'USD',
          openingBalanceMinor: accountType === 'credit-card' ? -enteredOpening : enteredOpening,
          creditLimitMinor:
            accountType === 'credit-card' && value.creditLimit.trim()
              ? parseMoney(value.creditLimit)
              : undefined,
        },
        editingId,
      );
      toast.success(editingId ? 'Account updated' : 'Account created');
      setShow(false);
      setEditingId(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save account');
    }
  });

  const setArchived = async (account: Account) => {
    if (!user || pendingArchiveId) return;
    const willArchive = !account.archived;
    setPendingArchiveId(account.id);
    try {
      await archiveAccount(user.uid, account.id, willArchive);
      toast.success(willArchive ? 'Account archived' : 'Account restored');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update account');
    } finally {
      setPendingArchiveId(undefined);
    }
  };

  return (
    <Page
      eyebrow="Your balances"
      title="Accounts"
      action={
        <Button onClick={openCreate}>
          <Plus size={18} />
          New account
        </Button>
      }
    >
      {show && (
        <section className="mb-8 border-y py-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl">
                {editingId ? 'Edit account' : 'Add an account'}
              </h2>
              <p className="mt-1 text-sm opacity-65">
                Credit cards track debt; bank and savings accounts track money you own.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShow(false);
                setEditingId(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <fieldset aria-describedby={editingId ? 'account-type-lock-note' : undefined}>
              <legend className="label">Account type</legend>
              {editingId ? (
                <div className="py-2">
                  {accountTypes
                    .filter(({ value }) => value === selectedType)
                    .map(({ value, label, icon: Icon }) => (
                      <div key={value} className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-mist text-jade dark:bg-white/10 dark:text-white">
                          <Icon size={20} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-semibold">{label}</p>
                          <p
                            id="account-type-lock-note"
                            className="mt-0.5 max-w-3xl text-sm text-ink/60 dark:text-white/60"
                          >
                            Account type is locked after creation because changing between money you
                            own and debt would change the meaning of every existing balance. Create
                            a new account if you need a different type.
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {accountTypes.map(({ value, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={selectedType === value}
                      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors ${
                        selectedType === value
                          ? 'border-jade bg-jade text-white'
                          : 'bg-white/60 hover:border-jade/50 dark:bg-white/[.04]'
                      }`}
                      onClick={() => setValue('type', value, { shouldDirty: true })}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" {...register('type')} />
            </fieldset>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Account name" error={errors.name?.message}>
                <input
                  className="input"
                  {...register('name', { required: 'Enter a name' })}
                  aria-invalid={Boolean(errors.name)}
                />
              </Field>
              <Field
                label={selectedType === 'credit-card' ? 'Opening amount owed' : 'Opening balance'}
              >
                <input
                  className="input amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register('openingBalance')}
                />
                {selectedType === 'credit-card' && (
                  <span className="mt-1.5 block text-xs opacity-55">
                    This is the debt when tracking begins; entries determine the current amount
                    owed.
                  </span>
                )}
              </Field>
              {selectedType === 'credit-card' && (
                <Field label="Credit limit (optional)">
                  <input
                    className="input amount"
                    inputMode="decimal"
                    placeholder="5,000.00"
                    {...register('creditLimit')}
                  />
                </Field>
              )}
            </div>
            <Button disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editingId ? 'Update account' : 'Save account'}
            </Button>
          </form>
        </section>
      )}
      {accounts.length ? (
        <section aria-label="Accounts" className="border-y">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onEdit={() => openEdit(account)}
              onArchive={() => setArchived(account)}
              archivePending={pendingArchiveId === account.id}
              archiveDisabled={Boolean(pendingArchiveId)}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="Create your first account"
          detail="Add cash, checking, savings, or a credit card to begin your ledger."
        />
      )}
    </Page>
  );
}

function AccountRow({
  account,
  onEdit,
  onArchive,
  archivePending,
  archiveDisabled,
}: {
  account: Account;
  onEdit: () => void;
  onArchive: () => Promise<void>;
  archivePending: boolean;
  archiveDisabled: boolean;
}) {
  const view = accountBalanceView(account);
  const isCredit = account.type === 'credit-card';
  const Icon = accountTypes.find(({ value }) => value === account.type)?.icon ?? WalletCards;
  return (
    <article
      className={`group border-b py-5 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8 ${
        account.archived ? 'opacity-55' : ''
      }`}
    >
      <Link
        to={`/accounts/${account.id}`}
        className="group/account grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-lg focus-visible:ring-offset-4 md:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        <span
          className={`row-span-2 grid size-10 shrink-0 place-items-center rounded-full md:row-span-1 ${
            isCredit
              ? 'bg-apricot/20 text-[#914027] dark:bg-apricot/20 dark:text-apricot'
              : 'bg-mist text-jade'
          }`}
        >
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="truncate font-display text-lg transition-colors group-hover/account:text-jade">
              {account.name}
            </span>
            <span className="text-sm capitalize text-ink/55 dark:text-white/55">
              {account.type.replace('-', ' ')}
            </span>
            {account.archived && (
              <span className="text-xs font-semibold text-ink/55 dark:text-white/55">Archived</span>
            )}
          </span>
          <span className="mt-2 block text-sm text-ink/60 dark:text-white/60">
            {isCredit
              ? `Available ${
                  view.availableMinor === undefined
                    ? 'not set'
                    : formatMoney(view.availableMinor, account.currency)
                } · Limit ${
                  account.creditLimitMinor === undefined
                    ? 'not set'
                    : formatMoney(account.creditLimitMinor, account.currency)
                }`
              : `Opened at ${formatMoney(account.openingBalanceMinor, account.currency)}`}
          </span>
        </span>
        <span className="col-start-2 shrink-0 text-left md:col-start-3 md:row-start-1 md:text-right">
          <span className="block text-sm text-ink/55 dark:text-white/55">{view.label}</span>
          <span
            className={`amount mt-1 block text-xl font-semibold ${
              isCredit ? 'text-[#914027] dark:text-apricot' : ''
            }`}
          >
            {formatMoney(view.primaryMinor, account.currency)}
          </span>
        </span>
      </Link>
      <div className="mt-3 flex justify-end gap-1 sm:mt-0">
        <Button variant="ghost" onClick={onEdit}>
          <Pencil size={16} />
          Edit
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" disabled={archiveDisabled} aria-busy={archivePending}>
              {archivePending ? (
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
              ) : account.archived ? (
                <RotateCcw size={16} />
              ) : (
                <Archive size={16} />
              )}
              {archivePending
                ? account.archived
                  ? 'Restoring…'
                  : 'Archiving…'
                : account.archived
                  ? 'Restore'
                  : 'Archive'}
            </Button>
          }
          title={`${account.archived ? 'Restore' : 'Archive'} “${account.name}”?`}
          description={
            account.archived
              ? 'This account will be available for new entries and transfers again.'
              : 'Existing entries and balances stay in your history, but this account will no longer be available for new entries or transfers.'
          }
          onConfirm={onArchive}
        />
      </div>
    </article>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-apricot">{error}</span>}
    </label>
  );
}
