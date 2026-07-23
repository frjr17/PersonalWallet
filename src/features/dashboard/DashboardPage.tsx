import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import {
  ArrowRight,
  CalendarClock,
  ChartLine,
  Check,
  FileUp,
  Plus,
  SkipForward,
  Target,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { MonthSwitcher } from '@/components/month-switcher';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import {
  ChartTooltip,
  categoricalColors,
  expenseColor,
  incomeColor,
  moneyTick,
  otherColor,
} from '@/components/charts/chart-theme';
import { monthRange, shiftMonthKey } from '@/lib/dates';
import { logError, userMessage } from '@/lib/errors';
import { useLedger } from '@/app/DataProvider';
import { parseTransaction, transactionsInRange } from '@/services/repositories';
import { confirmRecurring, skipRecurring } from '@/services/finance';
import { computeBudgetStatus } from '@/services/budgets';
import { expenseTotal, foldTop, incomeTotal, totalsByCategory } from '@/services/reports';
import { AccountFormDialog } from '@/features/accounts/AccountForm';
import { TransactionList } from '@/features/transactions/TransactionList';

const quickLinks = [
  { to: '/recurring', label: 'Planned payments', icon: CalendarClock },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/reports', label: 'Reports', icon: ChartLine },
  { to: '/imports', label: 'Import CSV', icon: FileUp },
] as const;

export function DashboardPage() {
  const ledger = useLedger();
  const {
    uid,
    accounts,
    activeAccounts,
    categories,
    month,
    monthTransactions,
    monthBudgets,
    recurring,
    loading,
  } = ledger;
  const navigate = useNavigate();
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const income = useMemo(() => incomeTotal(monthTransactions), [monthTransactions]);
  const expenses = useMemo(() => expenseTotal(monthTransactions), [monthTransactions]);
  const totalBalance = useMemo(
    () => activeAccounts.reduce((total, account) => total + account.currentBalanceMinor, 0),
    [activeAccounts],
  );

  const categorySpend = useMemo(
    () => foldTop(totalsByCategory(monthTransactions, categories, 'expense'), 5),
    [monthTransactions, categories],
  );

  // "vs past period to date": last month's spending over the same number of
  // elapsed days. One bounded fetch per month selection.
  const [previousExpenses, setPreviousExpenses] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPreviousExpenses(null);
    const current = monthRange(month);
    const previous = monthRange(shiftMonthKey(month, -1));
    const now = new Date();
    const elapsedMs =
      now >= current.start && now < current.end
        ? now.getTime() - current.start.getTime()
        : current.end.getTime() - current.start.getTime();
    const compareEnd = new Date(
      Math.min(previous.start.getTime() + elapsedMs, previous.end.getTime()),
    );
    getDocs(transactionsInRange(uid, previous.start, compareEnd))
      .then((snap) => {
        if (!cancelled) setPreviousExpenses(expenseTotal(snap.docs.map(parseTransaction)));
      })
      .catch((error) => logError('dashboard', error));
    return () => {
      cancelled = true;
    };
  }, [uid, month]);

  const spendChangePct =
    previousExpenses !== null && previousExpenses > 0
      ? Math.round(((expenses - previousExpenses) / previousExpenses) * 100)
      : null;

  const budgetStatuses = useMemo(
    () =>
      monthBudgets
        .map((budget) => computeBudgetStatus(budget, monthTransactions))
        .sort((a, b) => b.ratio - a.ratio),
    [monthBudgets, monthTransactions],
  );
  const budgetAlerts = budgetStatuses.filter((status) => status.state !== 'ok');

  const now = new Date();
  const dueRecurring = recurring.filter((item) => item.active && item.nextOccurrence <= now);
  const upcomingRecurring = recurring
    .filter((item) => item.active && item.nextOccurrence > now)
    .slice(0, 5);
  const recentTransactions = monthTransactions.slice(0, 8);

  async function confirmDue(id: string) {
    const item = dueRecurring.find((candidate) => candidate.id === id);
    if (!item) return;
    try {
      await confirmRecurring(ledger, item);
      toast.success(`Recorded “${item.description}”`);
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error, 'The occurrence was not recorded. Try again.'));
    }
  }

  async function skipDue(id: string) {
    const item = dueRecurring.find((candidate) => candidate.id === id);
    if (!item) return;
    try {
      await skipRecurring(uid, item);
      toast.success(`Skipped “${item.description}”`);
    } catch (error) {
      logError('recurring', error);
      toast.error(userMessage(error));
    }
  }

  if (loading) {
    return (
      <Page title="Dashboard" actions={<MonthSwitcher />}>
        <Skeleton className="h-24" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
        <Skeleton className="mt-4 h-72" />
      </Page>
    );
  }

  if (accounts.length === 0) {
    return (
      <Page title="Dashboard" actions={<MonthSwitcher />}>
        <EmptyState
          icon={Wallet}
          title="Welcome to your ledger"
          description="Create your first account, then record a transaction to see the month take shape."
          action={
            <Button onClick={() => navigate('/accounts')}>
              <Plus /> Create an account
            </Button>
          }
        />
      </Page>
    );
  }

  const flowData = [
    { name: 'Income', value: income, fill: incomeColor },
    { name: 'Expenses', value: expenses, fill: expenseColor },
  ];

  return (
    <Page title="Dashboard" actions={<MonthSwitcher />}>
      {dueRecurring.length > 0 && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="grid gap-2 py-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-primary" />
              {dueRecurring.length === 1
                ? '1 recurring transaction is due'
                : `${dueRecurring.length} recurring transactions are due`}
            </p>
            <ul className="grid gap-1.5">
              {dueRecurring.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{item.description}</span>
                  <Money
                    minor={item.type === 'income' ? item.amountMinor : -item.amountMinor}
                    signed
                    tone="auto"
                    className="text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => void confirmDue(item.id)}>
                    <Check /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Skip ${item.description}`}
                    onClick={() => void skipDue(item.id)}
                  >
                    <SkipForward />
                  </Button>
                </li>
              ))}
            </ul>
            {dueRecurring.length > 3 && (
              <Link to="/recurring" className="text-xs text-primary hover:underline">
                See all due items
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* List of accounts — colored chips, like a wallet laid open. */}
      <section aria-label="Accounts">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold">Accounts</h2>
          <span className="text-sm text-muted-foreground">
            Total{' '}
            <Money
              minor={totalBalance}
              tone={totalBalance < 0 ? 'expense' : 'neutral'}
              className="text-sm font-semibold"
            />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {activeAccounts.map((account, index) => (
            <Link
              key={account.id}
              to={`/accounts/${account.id}`}
              className="rounded-lg p-3 text-white shadow-xs outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60"
              style={{ background: categoricalColors[index % categoricalColors.length] }}
            >
              <span className="block truncate text-xs font-medium opacity-90">{account.name}</span>
              <Money minor={account.currentBalanceMinor} className="text-lg font-semibold" />
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setAddAccountOpen(true)}
            className="grid place-items-center rounded-lg border border-dashed border-primary/60 p-3 text-sm font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-4" /> Add account
            </span>
          </button>
        </div>
        <AccountFormDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      </section>

      {/* Quick links, one swipe away. */}
      <nav aria-label="Quick links" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <link.icon className="size-3.5" /> {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Expenses structure</CardTitle>
            <Link to="/reports" className="text-xs text-primary hover:underline">
              Go deeper <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">This month</p>
                <Money minor={expenses} className="text-2xl font-semibold" />
              </div>
              {spendChangePct !== null && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">vs past period to date</p>
                  <p
                    className={`font-mono text-lg font-semibold ${
                      spendChangePct > 0 ? 'text-expense' : 'text-income'
                    }`}
                  >
                    {spendChangePct > 0 ? '+' : ''}
                    {spendChangePct}%
                  </p>
                </div>
              )}
            </div>
            {categorySpend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses this month yet.
              </p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative h-44 w-44 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categorySpend}
                        dataKey="totalMinor"
                        nameKey="name"
                        innerRadius="66%"
                        outerRadius="100%"
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={2}
                      >
                        {categorySpend.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={entry.isOther ? otherColor : categoricalColors[index]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 grid place-items-center text-center"
                  >
                    <div>
                      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        Spent
                      </p>
                      <Money minor={expenses} className="text-sm font-semibold" />
                    </div>
                  </div>
                </div>
                <ul className="min-w-0 flex-1" aria-label="Spending by category">
                  {categorySpend.map((entry, index) => (
                    <li key={entry.name} className="flex items-center gap-2 py-1 text-sm">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          background: entry.isOther ? otherColor : categoricalColors[index],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <Money minor={entry.totalMinor} className="text-xs" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Income vs expenses</CardTitle>
            <span className="text-xs text-muted-foreground">
              Net{' '}
              <Money
                minor={income - expenses}
                signed
                tone="auto"
                className="text-xs font-semibold"
              />
            </span>
          </CardHeader>
          <CardContent>
            {income === 0 && expenses === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing recorded this month yet.
              </p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={flowData} layout="vertical" margin={{ left: 8, right: 48 }}>
                    <XAxis type="number" hide domain={[0, 'dataMax']} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={70}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)' }} />
                    <Bar
                      dataKey="value"
                      name="Amount"
                      radius={[0, 4, 4, 0]}
                      barSize={22}
                      label={{
                        position: 'right',
                        fill: 'var(--foreground)',
                        fontSize: 12,
                        formatter: (value: unknown) => moneyTick(Number(value)),
                      }}
                    >
                      {flowData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {budgetAlerts.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Budgets to watch</CardTitle>
            <Link to="/budgets" className="text-xs text-primary hover:underline">
              All budgets <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3">
            {budgetAlerts.slice(0, 4).map((status) => {
              const category = categories.find(
                (candidate) => candidate.id === status.budget.categoryId,
              );
              return (
                <div key={status.budget.id} className="grid gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CategoryIcon icon={category?.icon} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{category?.name}</span>
                    <span
                      className={
                        status.state === 'exceeded' ? 'text-expense' : 'text-muted-foreground'
                      }
                    >
                      <Money minor={status.spentMinor} /> /{' '}
                      <Money minor={status.budget.limitMinor} />
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.round(status.ratio * 100))}
                    aria-label={`${category?.name} budget usage`}
                    indicatorClassName={status.state === 'exceeded' ? 'bg-expense' : 'bg-chart-2'}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Link to="/transactions" className="text-xs text-primary hover:underline">
              See all <ArrowRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions this month yet.
              </p>
            ) : (
              <TransactionList transactions={recentTransactions} compact />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming recurring</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0">
            {upcomingRecurring.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              upcomingRecurring.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                    {format(item.nextOccurrence, 'MMM d')}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.description}</span>
                  <Money
                    minor={item.type === 'income' ? item.amountMinor : -item.amountMinor}
                    signed
                    tone="auto"
                    className="text-xs"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
