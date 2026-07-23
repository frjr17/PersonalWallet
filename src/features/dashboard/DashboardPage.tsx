import { addMonths, format, isSameDay, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { Button } from '@/components/ui/Button';
import { Page } from '@/components/layout/Page';
import { useData } from '@/app/DataProvider';
import { dashboardMetrics, budgetStatus } from '@/services/finance';
import { formatMoney } from '@/lib/money';
import { asDate } from '@/lib/dates';
export function DashboardPage() {
  const { month, setMonth, accounts, transactions, budgets, categories, recurring, loading } =
    useData();
  const metrics = dashboardMetrics(transactions);
  const currency = accounts[0]?.currency ?? 'USD';
  const byCategory = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({
      name: c.name,
      value: transactions
        .filter((t) => t.type === 'expense' && t.categoryId === c.id)
        .reduce((n, t) => n + t.amountMinor, 0),
    }))
    .filter((v) => v.value > 0);
  const bars = [
    { name: 'Income', value: metrics.income },
    { name: 'Expenses', value: metrics.expenses },
  ];
  const current = accounts.reduce((n, a) => n + a.currentBalanceMinor, 0);
  const visibleAccounts = accounts.slice(0, 3);
  const topCategory = byCategory.reduce<(typeof byCategory)[number] | undefined>(
    (largest, item) => (!largest || item.value > largest.value ? item : largest),
    undefined,
  );

  return (
    <Page
      eyebrow="Monthly ledger"
      title={format(month, 'MMMM yyyy')}
      action={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="secondary"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <section className="mb-8 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl">List of accounts</h2>
            <p className="mt-1 text-sm opacity-60">Quickly scan balances before opening details.</p>
          </div>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link to="/accounts">Account detail</Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleAccounts.map((account, index) => (
            <Link
              key={account.id}
              to={`/accounts/${account.id}`}
              className={`min-h-24 rounded-2xl p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                index === 0 ? 'bg-apricot' : 'bg-ink/55 dark:bg-white/15'
              }`}
            >
              <p className="truncate text-lg font-semibold">{account.name}</p>
              <p className="amount mt-1 text-2xl font-semibold">
                {formatMoney(account.currentBalanceMinor, account.currency)}
              </p>
            </Link>
          ))}
          <Link
            to="/accounts"
            className="flex min-h-24 items-center justify-between rounded-2xl border-2 border-jade/55 p-4 text-jade transition hover:bg-jade/10 dark:text-[#75cbb9]"
          >
            <span className="text-xl font-semibold">Add account</span>
            <Plus className="rounded-full bg-jade text-white" size={28} />
          </Link>
        </div>
        <div className="grid gap-3 rounded-3xl bg-ink/[.035] p-3 dark:bg-white/[.045] sm:grid-cols-4">
          <Summary
            label="Current balance"
            value={formatMoney(current, currency)}
            icon={<Wallet />}
          />
          <Summary
            label="Income"
            value={formatMoney(metrics.income, currency)}
            icon={<TrendingUp />}
          />
          <Summary
            label="Expenses"
            value={formatMoney(metrics.expenses, currency)}
            icon={<TrendingDown />}
          />
          <Summary
            label="Net flow"
            value={formatMoney(metrics.net, currency)}
            icon={<span className="font-mono">{metrics.savingsRate}%</span>}
          />
        </div>
      </section>
      {loading ? (
        <div className="animate-pulse border-y py-8">Loading your month…</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-6">
            <section className="card">
              <h2 className="font-display text-lg">Income and expenses</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars}>
                    <CartesianGrid vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="name" />
                    <YAxis hide />
                    <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                    <Bar dataKey="value" radius={[9, 9, 0, 0]}>
                      {bars.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#176B5B' : '#E98563'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card">
              <h2 className="font-display text-lg">Recent transactions</h2>
              <div className="mt-3 divide-y">
                {transactions.slice(0, 7).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center text-jade dark:text-[#67c7b5]">
                        <CategoryIcon
                          icon={categories.find((c) => c.id === t.categoryId)?.icon}
                          size={17}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{t.description}</p>
                        <p className="text-sm opacity-55">
                          {format(asDate(t.occurredAt), 'MMM d')} ·{' '}
                          {categories.find((c) => c.id === t.categoryId)?.name ?? 'Transfer'}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`amount font-semibold ${t.type === 'income' ? 'text-jade' : t.type === 'expense' ? 'text-apricot' : ''}`}
                    >
                      {t.type === 'expense' || t.transferRole === 'source' ? '-' : '+'}
                      {formatMoney(t.amountMinor, t.currency)}
                    </p>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="py-8 text-center opacity-60">Add the first entry for this month.</p>
                )}
              </div>
            </section>
          </div>
          <div className="space-y-6">
            <section className="card relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Expenses structure</h2>
                  <p className="eyebrow mt-4">Last 30 days</p>
                  <p className="amount mt-1 text-4xl font-semibold">
                    {formatMoney(metrics.expenses, currency)}
                  </p>
                </div>
                <Button asChild variant="secondary" className="rounded-full">
                  <Link to="/reports">Go deeper</Link>
                </Button>
              </div>
              {byCategory.length ? (
                <div className="relative h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="54%"
                        outerRadius="82%"
                        paddingAngle={2}
                      >
                        {byCategory.map((_, i) => (
                          <Cell
                            key={i}
                            fill={['#176B5B', '#E98563', '#81A69D', '#C4A882', '#657C75'][i % 5]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                  {topCategory && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <p className="max-w-28 text-lg font-semibold leading-tight">
                        {topCategory.name}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-12 text-center opacity-60">Spending will appear here.</p>
              )}
            </section>
            <section className="card">
              <h2 className="font-display text-lg">Budget watch</h2>
              <div className="mt-4 space-y-4">
                {budgets.map((b) => {
                  const spent = transactions
                    .filter((t) => t.type === 'expense' && t.categoryId === b.categoryId)
                    .reduce((n, t) => n + t.amountMinor, 0);
                  const status = budgetStatus(b, spent);
                  return (
                    <div key={b.id}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <CategoryIcon
                            icon={categories.find((c) => c.id === b.categoryId)?.icon}
                            className="text-jade dark:text-[#67c7b5]"
                            size={15}
                          />
                          {categories.find((c) => c.id === b.categoryId)?.name}
                        </span>
                        <span className="amount">{Math.round(status.usage)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-mist">
                        <div
                          className={`h-full rounded-full ${status.state === 'exceeded' ? 'bg-apricot' : 'bg-jade'}`}
                          style={{ width: `${Math.min(100, status.usage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!budgets.length && <p className="opacity-60">No budgets set for this month.</p>}
              </div>
            </section>
            <section className="card">
              <h2 className="font-display text-lg">Coming up</h2>
              <div className="mt-3">
                {recurring
                  .filter((r) => r.active && asDate(r.nextOccurrence) >= startOfMonth(month))
                  .slice(0, 4)
                  .map((r) => (
                    <div key={r.id} className="flex justify-between border-b py-3">
                      <span>{r.description}</span>
                      <span className="text-sm opacity-60">
                        {isSameDay(asDate(r.nextOccurrence), new Date())
                          ? 'Today'
                          : format(asDate(r.nextOccurrence), 'MMM d')}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
      )}
      <Button
        asChild
        className="fixed bottom-24 right-5 z-20 size-16 rounded-2xl p-0 shadow-xl lg:hidden"
        aria-label="Add transaction"
      >
        <Link to="/transactions/new">
          <Plus size={32} />
        </Link>
      </Button>
    </Page>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/60 p-4 dark:bg-white/[.06]">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm opacity-70">
        <span>{label}</span>
        <span className="grid size-8 place-items-center rounded-full bg-jade/10 text-jade dark:text-[#75cbb9]">
          {icon}
        </span>
      </div>
      <p className="amount text-xl font-semibold">{value}</p>
    </div>
  );
}
