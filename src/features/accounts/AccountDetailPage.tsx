import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartTooltip,
  axisDefaults,
  gridDefaults,
  moneyTick,
} from '@/components/charts/chart-theme';
import { logError, userMessage } from '@/lib/errors';
import type { Transaction } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { parseTransaction, setAccountArchived, transactionsCol } from '@/services/repositories';
import { legEffect } from '@/lib/ledger';
import { accountTypeMeta } from '@/features/accounts/accountMeta';
import { AccountFormDialog } from '@/features/accounts/AccountForm';
import { TransactionList } from '@/features/transactions/TransactionList';

const PAGE_SIZE = 50;

export function AccountDetailPage() {
  const { accountId = '' } = useParams();
  const navigate = useNavigate();
  const { uid, accounts, loading } = useLedger();
  const account = accounts.find((candidate) => candidate.id === accountId);

  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    const clauses = [
      where('accountId', '==', accountId),
      ...(from ? [where('occurredAt', '>=', Timestamp.fromDate(new Date(`${from}T00:00`)))] : []),
      ...(to ? [where('occurredAt', '<', Timestamp.fromDate(new Date(`${to}T24:00`)))] : []),
      orderBy('occurredAt', 'desc'),
      limit(PAGE_SIZE * pageCount),
    ];
    return onSnapshot(
      query(transactionsCol(uid), ...clauses),
      (snap) => setRows(snap.docs.map(parseTransaction)),
      (error) => logError('account-detail', error),
    );
  }, [uid, accountId, from, to, pageCount]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((txn) =>
      [txn.description, txn.merchant, txn.notes, ...txn.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, search]);

  // Balance trend over the loaded (unfiltered) history, walked back from the
  // current balance. Hidden while date filters narrow the window.
  const trend = useMemo(() => {
    if (!rows || !account || from || to) return [];
    let running = account.currentBalanceMinor;
    const points = rows.map((txn) => {
      const point = { date: format(txn.occurredAt, 'MMM d'), balance: running };
      running -= legEffect(txn);
      return point;
    });
    points.push({ date: 'Start', balance: running });
    return points.reverse();
  }, [rows, account, from, to]);

  async function toggleArchived() {
    if (!account) return;
    try {
      await setAccountArchived(uid, account, !account.archived);
      toast.success(account.archived ? 'Account restored' : 'Account archived');
    } catch (error) {
      logError('accounts', error);
      toast.error(userMessage(error));
    }
  }

  if (loading) {
    return (
      <Page title="Account">
        <Skeleton className="h-40" />
      </Page>
    );
  }

  if (!account) {
    return (
      <Page title="Account not found">
        <EmptyState
          title="This account does not exist"
          description="It may have been removed. Head back to your accounts."
          action={
            <Button onClick={() => navigate('/accounts')}>
              <ArrowLeft /> All accounts
            </Button>
          }
        />
      </Page>
    );
  }

  const meta = accountTypeMeta[account.type];
  const hasMore = rows !== null && rows.length === PAGE_SIZE * pageCount;

  return (
    <Page
      title={account.name}
      description={meta.label}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => navigate(`/transactions/new?account=${account.id}`)}
            disabled={account.archived}
          >
            <Plus /> Add transaction
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit account"
            onClick={() => setEditOpen(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={account.archived ? 'Restore account' : 'Archive account'}
            onClick={() => void toggleArchived()}
          >
            {account.archived ? <ArchiveRestore /> : <Archive />}
          </Button>
        </>
      }
    >
      {account.archived && (
        <Badge variant="secondary" className="mb-4">
          Archived — history stays, new transactions are blocked
        </Badge>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium text-muted-foreground">Current balance</p>
            <Money
              minor={account.currentBalanceMinor}
              tone={account.currentBalanceMinor < 0 ? 'expense' : 'neutral'}
              className="mt-1 block text-3xl font-semibold"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Opened at <Money minor={account.openingBalanceMinor} className="text-xs" />
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length < 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {from || to
                  ? 'The trend hides while date filters are active.'
                  : 'The trend appears after the first transactions.'}
              </p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 4, right: 8 }}>
                    <CartesianGrid {...gridDefaults} />
                    <XAxis dataKey="date" {...axisDefaults} minTickGap={32} />
                    <YAxis
                      {...axisDefaults}
                      tickFormatter={moneyTick}
                      width={56}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Balance"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search history"
                aria-label="Search this account's history"
                className="pl-9"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="detail-from" className="sr-only">
                From date
              </Label>
              <Input
                id="detail-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="From date"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="detail-to" className="sr-only">
                To date
              </Label>
              <Input
                id="detail-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="To date"
              />
            </div>
          </div>
          {rows === null ? (
            <div className="grid gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions match here yet.
            </p>
          ) : (
            <>
              <TransactionList transactions={filtered} showAccount={false} />
              {hasMore && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => setPageCount((count) => count + 1)}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AccountFormDialog account={account} open={editOpen} onOpenChange={setEditOpen} />
    </Page>
  );
}
