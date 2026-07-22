import { addMonths, format, isSameDay, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
      <section className="mb-6 overflow-hidden rounded-[1.7rem] bg-jade text-white shadow-card">
        <div className="grid gap-px bg-white/15 sm:grid-cols-4">
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
        <div className="flex h-12 items-end gap-1 px-6" aria-hidden>
          {Array.from({ length: 31 }, (_, i) => (
            <span
              key={i}
              className="min-h-1 flex-1 rounded-t bg-oat/35"
              style={{ height: `${15 + ((i * 17 + transactions.length * 7) % 70)}%` }}
            />
          ))}
        </div>
      </section>
      {loading ? (
        <div className="card animate-pulse">Loading your month…</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-5">
            <Card>
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
            </Card>
            <Card>
              <h2 className="font-display text-lg">Recent transactions</h2>
              <div className="mt-3 divide-y">
                {transactions.slice(0, 7).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold">{t.description}</p>
                      <p className="text-sm opacity-55">
                        {format(asDate(t.occurredAt), 'MMM d')} ·{' '}
                        {categories.find((c) => c.id === t.categoryId)?.name ?? 'Transfer'}
                      </p>
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
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <h2 className="font-display text-lg">Spending by category</h2>
              {byCategory.length ? (
                <div className="h-64">
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
                </div>
              ) : (
                <p className="py-12 text-center opacity-60">Spending will appear here.</p>
              )}
            </Card>
            <Card>
              <h2 className="font-display text-lg">Budget watch</h2>
              <div className="mt-4 space-y-4">
                {budgets.map((b) => {
                  const spent = transactions
                    .filter((t) => t.type === 'expense' && t.categoryId === b.categoryId)
                    .reduce((n, t) => n + t.amountMinor, 0);
                  const status = budgetStatus(b, spent);
                  return (
                    <div key={b.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{categories.find((c) => c.id === b.categoryId)?.name}</span>
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
            </Card>
            <Card>
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
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-jade p-5">
      <div className="mb-5 flex items-center justify-between text-oat/60">
        <span className="eyebrow !text-oat/60">{label}</span>
        {icon}
      </div>
      <p className="amount text-xl font-semibold sm:text-2xl">{value}</p>
    </div>
  );
}
