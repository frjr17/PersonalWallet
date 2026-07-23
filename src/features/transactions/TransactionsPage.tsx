import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { ArrowLeftRight, Plus, Search, X } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
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
import { logError } from '@/lib/errors';
import type { Transaction } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { parseTransaction, transactionsCol } from '@/services/repositories';
import { TransactionList } from '@/features/transactions/TransactionList';

const PAGE_SIZE = 50;

type SortOrder = 'date' | 'amount-desc' | 'amount-asc';

export function TransactionsPage() {
  const { uid, accounts, categories } = useLedger();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortOrder>('date');

  // Server side: date range + incremental loading, one bounded live query.
  // Everything else filters the loaded rows client-side.
  useEffect(() => {
    const clauses = [
      ...(from ? [where('occurredAt', '>=', Timestamp.fromDate(new Date(`${from}T00:00`)))] : []),
      ...(to ? [where('occurredAt', '<', Timestamp.fromDate(new Date(`${to}T24:00`)))] : []),
      orderBy('occurredAt', 'desc'),
      limit(PAGE_SIZE * pageCount),
    ];
    return onSnapshot(
      query(transactionsCol(uid), ...clauses),
      (snap) => setRows(snap.docs.map(parseTransaction)),
      (error) => logError('transactions', error),
    );
  }, [uid, from, to, pageCount]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    let result = rows.filter((txn) => {
      if (type !== 'all' && txn.type !== type) return false;
      if (accountId !== 'all' && txn.accountId !== accountId) return false;
      if (categoryId !== 'all' && txn.categoryId !== categoryId) return false;
      if (needle) {
        const haystack = [txn.description, txn.merchant, txn.notes, ...txn.tags]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    if (sort !== 'date') {
      result = [...result].sort((a, b) =>
        sort === 'amount-desc' ? b.amountMinor - a.amountMinor : a.amountMinor - b.amountMinor,
      );
    }
    return result;
  }, [rows, search, accountId, categoryId, type, sort]);

  const hasFilters =
    search !== '' ||
    accountId !== 'all' ||
    categoryId !== 'all' ||
    type !== 'all' ||
    from !== '' ||
    to !== '';
  const hasMore = rows !== null && rows.length === PAGE_SIZE * pageCount;
  const loading = rows === null;

  function clearFilters() {
    setSearch('');
    setAccountId('all');
    setCategoryId('all');
    setType('all');
    setFrom('');
    setTo('');
    setSort('date');
  }

  return (
    <Page
      title="Transactions"
      description="Every entry in your ledger."
      actions={
        <Button onClick={() => navigate('/transactions/new')}>
          <Plus /> New transaction
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search description, merchant, notes, tags"
            aria-label="Search transactions"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="grid gap-1">
            <Label htmlFor="filter-type" className="text-xs text-muted-foreground">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filter-account" className="text-xs text-muted-foreground">
              Account
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="filter-account">
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
            <Label htmlFor="filter-category" className="text-xs text-muted-foreground">
              Category
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="filter-category">
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
          <div className="grid gap-1">
            <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filter-sort" className="text-xs text-muted-foreground">
              Sort
            </Label>
            <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
              <SelectTrigger id="filter-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest first</SelectItem>
                <SelectItem value="amount-desc">Largest amount</SelectItem>
                <SelectItem value="amount-asc">Smallest amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={hasFilters ? 'Nothing matches these filters' : 'No transactions yet'}
          description={
            hasFilters
              ? 'Loosen or clear the filters to see more of your ledger.'
              : 'Record your first income or expense to start the ledger.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => navigate('/transactions/new')}>
                <Plus /> New transaction
              </Button>
            )
          }
        />
      ) : (
        <>
          <TransactionList
            transactions={filtered}
            flatLabel={sort === 'date' ? undefined : 'Sorted by amount'}
          />
          {hasMore && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => setPageCount((count) => count + 1)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
