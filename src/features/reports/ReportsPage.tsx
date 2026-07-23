import { useEffect, useMemo, useState } from 'react';
import { getDocs, query as fsQuery, where } from 'firebase/firestore';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Download, ChartLine } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Progress } from '@/components/ui/progress';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import {
  ChartTooltip,
  axisDefaults,
  categoricalColors,
  expenseColor,
  gridDefaults,
  incomeColor,
  moneyTick,
} from '@/components/charts/chart-theme';
import { toDateInput, formatMonthLabel } from '@/lib/dates';
import { logError } from '@/lib/errors';
import type { Budget, Transaction } from '@/types/domain';
import { useLedger, useSettings } from '@/app/DataProvider';
import {
  budgetsCol,
  parseBudget,
  parseTransaction,
  transactionsInRange,
} from '@/services/repositories';
import { computeBudgetStatus } from '@/services/budgets';
import {
  balanceTrend,
  expenseTotal,
  incomeTotal,
  monthlyCashFlow,
  monthsInRange,
  savingsRate,
  totalsByCategory,
} from '@/services/reports';
import { downloadFile, transactionsToCsv } from '@/services/csv';

type RangePreset = '3m' | '6m' | '12m' | 'custom';

function CategoryBars({
  totals,
  color,
}: {
  totals: { categoryId: string; name: string; icon: string; totalMinor: number }[];
  color: string;
}) {
  const max = totals[0]?.totalMinor ?? 0;
  if (totals.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this range.</p>;
  return (
    <ul className="grid gap-2.5">
      {totals.slice(0, 10).map((entry) => (
        <li key={entry.categoryId} className="grid gap-1">
          <div className="flex items-center gap-2 text-sm">
            <CategoryIcon icon={entry.icon} className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            <Money minor={entry.totalMinor} className="text-xs" />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{ width: `${max ? (entry.totalMinor / max) * 100 : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportsPage() {
  const { uid, accounts, categories, month } = useLedger();
  const { settings } = useSettings();

  const [preset, setPreset] = useState<RangePreset>('6m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const range = useMemo(() => {
    const now = new Date();
    if (preset === 'custom' && customFrom) {
      return {
        start: new Date(`${customFrom}T00:00`),
        end: customTo ? new Date(`${customTo}T23:59`) : now,
      };
    }
    const months = preset === '3m' ? 3 : preset === '12m' ? 12 : 6;
    return { start: startOfMonth(subMonths(now, months - 1)), end: endOfMonth(now) };
  }, [preset, customFrom, customTo]);

  // One bounded fetch per range: from range start THROUGH TODAY so balance
  // trends can rewind from current balances; charts slice to the range end.
  useEffect(() => {
    let cancelled = false;
    const fetchEnd = new Date() > range.end ? new Date() : range.end;
    getDocs(transactionsInRange(uid, range.start, fetchEnd))
      .then((snap) => {
        if (!cancelled) setTransactions(snap.docs.map(parseTransaction));
      })
      .catch((error) => logError('reports', error));
    return () => {
      cancelled = true;
    };
  }, [uid, range.start, range.end]);

  const months = useMemo(() => monthsInRange(range.start, range.end), [range]);

  useEffect(() => {
    let cancelled = false;
    getDocs(
      fsQuery(
        budgetsCol(uid),
        where('period', '>=', months[0] ?? month),
        where('period', '<=', months[months.length - 1] ?? month),
      ),
    )
      .then((snap) => {
        if (!cancelled) setBudgets(snap.docs.map(parseBudget));
      })
      .catch((error) => logError('reports', error));
    return () => {
      cancelled = true;
    };
  }, [uid, months, month]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((txn) => {
      if (txn.occurredAt > range.end) return false;
      if (accountFilter !== 'all' && txn.accountId !== accountFilter) return false;
      if (categoryFilter !== 'all' && txn.categoryId !== categoryFilter) return false;
      return true;
    });
  }, [transactions, range.end, accountFilter, categoryFilter]);

  const cashFlow = useMemo(() => monthlyCashFlow(filtered), [filtered]);
  const expensesByCategory = useMemo(
    () => totalsByCategory(filtered, categories, 'expense'),
    [filtered, categories],
  );
  const incomeByCategory = useMemo(
    () => totalsByCategory(filtered, categories, 'income'),
    [filtered, categories],
  );

  const trendAccounts = useMemo(() => {
    const pool =
      accountFilter === 'all'
        ? accounts.filter((account) => !account.archived)
        : accounts.filter((account) => account.id === accountFilter);
    return pool.slice(0, 5);
  }, [accounts, accountFilter]);

  const balancePoints = useMemo(() => {
    if (!transactions) return [];
    // Balance trend ignores the category filter — balances are account-level.
    const scoped =
      accountFilter === 'all'
        ? transactions
        : transactions.filter((txn) => txn.accountId === accountFilter);
    return balanceTrend(trendAccounts, scoped, months).map((point) => ({
      month: formatMonthLabel(point.month, settings.locale),
      ...point.balances,
    }));
  }, [transactions, trendAccounts, months, accountFilter, settings.locale]);

  const budgetRows = useMemo(() => {
    if (!transactions) return [];
    return budgets
      .map((budget) => {
        const monthTxns = filtered.filter(
          (txn) => format(txn.occurredAt, 'yyyy-MM') === budget.period,
        );
        return { period: budget.period, status: computeBudgetStatus(budget, monthTxns) };
      })
      .sort((a, b) => b.period.localeCompare(a.period) || b.status.ratio - a.status.ratio);
  }, [budgets, filtered, transactions]);

  const income = incomeTotal(filtered);
  const expenses = expenseTotal(filtered);
  const rate = savingsRate(filtered);

  function exportCsv() {
    const csv = transactionsToCsv(filtered, accounts, categories);
    downloadFile(
      `transactions-${toDateInput(range.start)}-to-${toDateInput(range.end)}.csv`,
      csv,
      'text/csv',
    );
  }

  const loading = transactions === null;

  return (
    <Page
      title="Reports"
      description="The longer view of your money."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={loading || filtered.length === 0}>
          <Download /> Export CSV
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1">
          <Label htmlFor="report-range" className="text-xs text-muted-foreground">
            Range
          </Label>
          <Select value={preset} onValueChange={(value) => setPreset(value as RangePreset)}>
            <SelectTrigger id="report-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {preset === 'custom' && (
          <>
            <div className="grid gap-1">
              <Label htmlFor="report-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="report-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="report-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="report-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </div>
          </>
        )}
        <div className="grid gap-1">
          <Label htmlFor="report-account" className="text-xs text-muted-foreground">
            Account
          </Label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger id="report-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="report-category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="report-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="No data in this range"
          description="Widen the range or clear filters to see reports."
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-medium text-muted-foreground">Income</p>
                <Money minor={income} className="mt-1 block text-xl font-semibold" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-medium text-muted-foreground">Expenses</p>
                <Money minor={expenses} className="mt-1 block text-xl font-semibold" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-medium text-muted-foreground">Net</p>
                <Money
                  minor={income - expenses}
                  signed
                  tone="auto"
                  className="mt-1 block text-xl font-semibold"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-medium text-muted-foreground">Savings rate</p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {Math.round(rate * 100)}
                  <span className="align-[0.28em] text-[0.68em] font-medium">%</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly cash flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={cashFlow} margin={{ top: 4, right: 8 }} barCategoryGap="24%">
                    <CartesianGrid {...gridDefaults} />
                    <XAxis
                      dataKey="month"
                      {...axisDefaults}
                      tickFormatter={(key: string) => formatMonthLabel(key, settings.locale)}
                    />
                    <YAxis {...axisDefaults} tickFormatter={moneyTick} width={56} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'var(--muted)' }}
                      labelFormatter={(key) => formatMonthLabel(String(key), settings.locale)}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => (
                        <span className="text-xs text-muted-foreground">{value}</span>
                      )}
                    />
                    <Bar
                      dataKey="incomeMinor"
                      name="Income"
                      fill={incomeColor}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expenseMinor"
                      name="Expenses"
                      fill={expenseColor}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by category</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars totals={expensesByCategory} color="var(--chart-expense)" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Income by category</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars totals={incomeByCategory} color="var(--chart-income)" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={cashFlow} margin={{ top: 4, right: 8 }}>
                      <CartesianGrid {...gridDefaults} />
                      <XAxis
                        dataKey="month"
                        {...axisDefaults}
                        tickFormatter={(key: string) => formatMonthLabel(key, settings.locale)}
                      />
                      <YAxis {...axisDefaults} tickFormatter={moneyTick} width={56} />
                      <Tooltip
                        content={<ChartTooltip />}
                        labelFormatter={(key) => formatMonthLabel(String(key), settings.locale)}
                      />
                      <Line
                        type="monotone"
                        dataKey="expenseMinor"
                        name="Expenses"
                        stroke={expenseColor}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Account balance trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={balancePoints} margin={{ top: 4, right: 8 }}>
                      <CartesianGrid {...gridDefaults} />
                      <XAxis dataKey="month" {...axisDefaults} minTickGap={24} />
                      <YAxis {...axisDefaults} tickFormatter={moneyTick} width={56} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                      {trendAccounts.map((account, index) => (
                        <Line
                          key={account.id}
                          type="monotone"
                          dataKey={account.id}
                          name={account.name}
                          stroke={categoricalColors[index]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Budget performance</CardTitle>
            </CardHeader>
            <CardContent>
              {budgetRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No budgets in this range yet.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {budgetRows.map(({ period, status }) => {
                    const category = categories.find(
                      (candidate) => candidate.id === status.budget.categoryId,
                    );
                    return (
                      <li key={status.budget.id} className="grid gap-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <CategoryIcon icon={category?.icon} className="text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            {category?.name} ·{' '}
                            <span className="text-muted-foreground">
                              {formatMonthLabel(period, settings.locale)}
                            </span>
                          </span>
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
                          aria-label={`${category?.name} ${period} budget usage`}
                          indicatorClassName={
                            status.state === 'exceeded'
                              ? 'bg-expense'
                              : status.state === 'warning'
                                ? 'bg-chart-2'
                                : undefined
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Page>
  );
}
