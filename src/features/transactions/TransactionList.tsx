import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { ArrowLeftRight, Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { logError, userMessage } from '@/lib/errors';
import type { Transaction } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { deleteTransaction } from '@/services/finance';
import { legEffect } from '@/lib/ledger';

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMM d');
}

function RowActions({ txn, onDelete }: { txn: Transaction; onDelete: () => void }) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isTransfer = txn.type === 'transfer';
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${txn.description}`}
            className="opacity-60 group-hover:opacity-100"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate(`/transactions/${txn.id}/edit`)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {!isTransfer && (
            <DropdownMenuItem onSelect={() => navigate(`/transactions/new?from=${txn.id}`)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        title={isTransfer ? 'Delete this transfer?' : 'Delete this transaction?'}
        description={
          isTransfer
            ? 'Both sides of the transfer are removed and both account balances are restored.'
            : 'The transaction is removed and the account balance is restored.'
        }
        confirmLabel="Delete"
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onDelete}
      />
    </>
  );
}

/**
 * The ledger: day-grouped rows with a ruled amount column.
 * Income prints in green ink, expenses in red, transfers stay neutral.
 */
export function TransactionList({
  transactions,
  showAccount = true,
  compact = false,
  flatLabel,
}: {
  transactions: Transaction[];
  showAccount?: boolean;
  compact?: boolean;
  /** Render as one flat section with this header instead of day groups. */
  flatLabel?: string;
}) {
  const { uid, accounts, categories } = useLedger();
  const navigate = useNavigate();

  const groups = useMemo(() => {
    if (flatLabel) return [['flat', transactions] as const];
    const map = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const key = format(txn.occurredAt, 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(txn);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [transactions, flatLabel]);

  function accountName(id: string): string {
    return accounts.find((account) => account.id === id)?.name ?? 'Unknown account';
  }

  async function remove(txn: Transaction) {
    try {
      await deleteTransaction(uid, txn);
      toast.success(txn.type === 'transfer' ? 'Transfer deleted' : 'Transaction deleted');
    } catch (error) {
      logError('transactions', error);
      toast.error(userMessage(error, 'The transaction was not deleted. Try again.'));
    }
  }

  return (
    <div>
      {groups.map(([day, dayTransactions]) => {
        const first = dayTransactions[0]!;
        const dayNet = dayTransactions
          .filter((txn) => txn.type !== 'transfer')
          .reduce((total, txn) => total + legEffect(txn), 0);
        const heading = flatLabel ?? dayLabel(first.occurredAt);
        return (
          <section key={day} aria-label={heading}>
            <header className="flex items-baseline justify-between border-b pt-4 pb-1.5">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {heading}
              </h3>
              {!compact && dayNet !== 0 && (
                <Money minor={dayNet} signed tone="auto" className="text-xs" />
              )}
            </header>
            <ul>
              {dayTransactions.map((txn) => {
                const category = categories.find((candidate) => candidate.id === txn.categoryId);
                const isTransfer = txn.type === 'transfer';
                const effect = legEffect(txn);
                return (
                  <li
                    key={txn.id}
                    className="group flex items-center gap-3 border-b border-dashed py-2.5 last:border-b-0"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                      {isTransfer ? (
                        <ArrowLeftRight className="size-4" aria-hidden="true" />
                      ) : (
                        <CategoryIcon icon={category?.icon} />
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/transactions/${txn.id}/edit`)}
                      className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <span className="block truncate text-sm font-medium">
                        {txn.description || txn.merchant || category?.name || 'Transaction'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          isTransfer ? 'Transfer' : (category?.name ?? 'Uncategorized'),
                          showAccount ? accountName(txn.accountId) : null,
                          txn.merchant,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                    <Money
                      minor={effect}
                      signed
                      tone={isTransfer ? 'transfer' : 'auto'}
                      className="text-sm font-medium"
                    />
                    {!compact && <RowActions txn={txn} onDelete={() => void remove(txn)} />}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
