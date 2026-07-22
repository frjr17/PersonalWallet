import { format } from 'date-fns';
import { Copy, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { asDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { deleteTransaction } from '@/services/repositories';
export function TransactionsPage() {
  const { transactions, categories, accounts } = useData(),
    { user } = useAuth(),
    [search, setSearch] = useState(''),
    [type, setType] = useState('all');
  const rows = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (type === 'all' || t.type === type) &&
          `${t.description} ${t.merchant ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [transactions, search, type],
  );
  return (
    <Page
      eyebrow="Selected month"
      title="Transactions"
      action={
        <Button asChild>
          <Link to="/transactions/new">
            <Plus size={18} />
            Add entry
          </Link>
        </Button>
      }
    >
      <div className="card mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search transactions</span>
          <Search className="absolute left-3 top-3 text-ink/40" size={19} />
          <input
            className="input pl-10"
            placeholder="Search descriptions or merchants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="select sm:w-44"
          aria-label="Transaction type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfers</option>
        </select>
      </div>
      {rows.length ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider opacity-50">
                <th className="p-4">Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-4 text-sm">{format(asDate(t.occurredAt), 'MMM d')}</td>
                  <td>
                    <p className="font-semibold">{t.description}</p>
                    <span className="text-xs opacity-50">{t.type}</span>
                  </td>
                  <td>{accounts.find((a) => a.id === t.accountId)?.name}</td>
                  <td>{categories.find((c) => c.id === t.categoryId)?.name ?? 'Transfer'}</td>
                  <td
                    className={`amount text-right font-semibold ${t.type === 'expense' ? 'text-apricot' : t.type === 'income' ? 'text-jade' : ''}`}
                  >
                    {t.type === 'expense' || t.transferRole === 'source' ? '-' : '+'}
                    {formatMoney(t.amountMinor, t.currency)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      {t.type !== 'transfer' && (
                        <>
                          <Button variant="ghost" asChild aria-label="Edit">
                            <Link to={`/transactions/${t.id}/edit`}>
                              <Edit3 size={16} />
                            </Link>
                          </Button>
                          <Button variant="ghost" asChild aria-label="Duplicate">
                            <Link to={`/transactions/new?duplicate=${t.id}`}>
                              <Copy size={16} />
                            </Link>
                          </Button>
                        </>
                      )}
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" aria-label="Delete">
                            <Trash2 size={16} />
                          </Button>
                        }
                        title="Delete this entry?"
                        description={
                          t.type === 'transfer'
                            ? 'Both linked transfer entries and balance effects will be removed.'
                            : 'The account balance will be updated automatically.'
                        }
                        onConfirm={async () => {
                          if (user) {
                            await deleteTransaction(user.uid, t, transactions);
                            toast.success('Transaction deleted');
                          }
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No matching entries"
          detail="Change the filters or add a transaction for this month."
        />
      )}
    </Page>
  );
}
