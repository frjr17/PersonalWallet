import { format } from 'date-fns';
import { Link, useParams } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { useData } from '@/app/DataProvider';
import { asDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { accountBalanceView } from '@/services/finance';
import { accountTransactionPresentation } from './accountPresentation';
export function AccountDetailPage() {
  const { accountId } = useParams(),
    { accounts, transactions } = useData();
  const account = accounts.find((a) => a.id === accountId);
  if (!account)
    return (
      <Page title="Account not found">
        <p>The account may be archived or unavailable.</p>
      </Page>
    );
  const rows = transactions.filter((t) => t.accountId === account.id);
  const balance = accountBalanceView(account);
  return (
    <Page
      eyebrow={account.type}
      title={account.name}
      action={
        <Button asChild>
          <Link to="/transactions/new">Add entry</Link>
        </Button>
      }
    >
      <section
        aria-labelledby="account-balance-heading"
        className="border-y py-6 lg:grid lg:grid-cols-[minmax(16rem,.7fr)_minmax(0,1.3fr)] lg:gap-10"
      >
        <div>
          <h2 id="account-balance-heading" className="text-sm text-ink/60 dark:text-white/60">
            {balance.label}
          </h2>
          <p className="amount mt-2 text-4xl font-semibold">
            {formatMoney(balance.primaryMinor, account.currency)}
          </p>
        </div>
        <div className="mt-6 border-t pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          {account.type === 'credit-card' ? (
            <div className="grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-ink/60 dark:text-white/60">Available credit</p>
                <p className="amount mt-1 text-lg font-semibold">
                  {balance.availableMinor === undefined
                    ? 'Not set'
                    : formatMoney(balance.availableMinor, account.currency)}
                </p>
              </div>
              <div>
                <p className="text-ink/60 dark:text-white/60">Credit limit</p>
                <p className="amount mt-1 text-lg font-semibold">
                  {account.creditLimitMinor === undefined
                    ? 'Not set'
                    : formatMoney(account.creditLimitMinor, account.currency)}
                </p>
              </div>
              <p className="text-sm text-ink/55 dark:text-white/55 sm:col-span-2">
                Expenses increase the amount owed. Transfers into this card are payments.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink/60 dark:text-white/60">Opening balance</p>
              <p className="amount mt-1 text-lg font-semibold">
                {formatMoney(account.openingBalanceMinor, account.currency)}
              </p>
            </div>
          )}
        </div>
      </section>
      <section aria-labelledby="account-activity-heading" className="mt-9">
        <h2 id="account-activity-heading" className="font-display text-lg">
          This month
        </h2>
        <div className="mt-3 border-y divide-y">
          {rows.map((transaction) => {
            const presentation = accountTransactionPresentation(account.type, transaction);
            return (
              <div className="flex items-start justify-between gap-4 py-4" key={transaction.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{transaction.description}</p>
                  <p className="mt-0.5 text-sm opacity-55">
                    {format(asDate(transaction.occurredAt), 'MMM d, yyyy')} · {presentation.label}
                  </p>
                  {presentation.explanation && (
                    <p className="mt-0.5 text-xs text-ink/50 dark:text-white/50">
                      {presentation.explanation}
                    </p>
                  )}
                </div>
                <p
                  className="amount shrink-0 text-right"
                  aria-label={`${presentation.label}: ${presentation.accessibleAmountEffect} ${formatMoney(transaction.amountMinor, transaction.currency)}`}
                >
                  <span className="block">
                    {presentation.sign}
                    {formatMoney(transaction.amountMinor, transaction.currency)}
                  </span>
                  {account.type === 'credit-card' && (
                    <span className="mt-0.5 block font-sans text-xs font-normal opacity-55">
                      amount owed
                    </span>
                  )}
                </p>
              </div>
            );
          })}
          {!rows.length && (
            <p className="py-8 text-center opacity-60">No entries in the selected month.</p>
          )}
        </div>
      </section>
    </Page>
  );
}
