import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, MoreVertical, Pencil, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { sumMinor } from '@/lib/money';
import { logError, userMessage } from '@/lib/errors';
import type { Account } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { setAccountArchived } from '@/services/repositories';
import { accountTypeMeta } from '@/features/accounts/accountMeta';
import { AccountFormDialog } from '@/features/accounts/AccountForm';

function AccountCard({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const { uid } = useLedger();
  const meta = accountTypeMeta[account.type];

  async function toggleArchived() {
    try {
      await setAccountArchived(uid, account, !account.archived);
      toast.success(account.archived ? 'Account restored' : 'Account archived');
    } catch (error) {
      logError('accounts', error);
      toast.error(userMessage(error));
    }
  }

  return (
    <Card className={account.archived ? 'opacity-60' : undefined}>
      <CardContent className="flex items-start justify-between gap-3">
        <Link
          to={`/accounts/${account.id}`}
          className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <meta.icon className="size-4" />
            <span className="text-xs font-medium">{meta.label}</span>
            {account.archived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="mt-1 truncate font-medium">{account.name}</p>
          <Money
            minor={account.currentBalanceMinor}
            tone={account.currentBalanceMinor < 0 ? 'expense' : 'neutral'}
            className="mt-2 block text-2xl font-semibold"
          />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${account.name}`}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void toggleArchived()}>
              {account.archived ? (
                <>
                  <ArchiveRestore /> Restore
                </>
              ) : (
                <>
                  <Archive /> Archive
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export function AccountsPage() {
  const { accounts, activeAccounts, loading } = useLedger();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  const archived = accounts.filter((account) => account.archived);
  const netWorth = sumMinor(activeAccounts.map((account) => account.currentBalanceMinor));

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <Page
      title="Accounts"
      description="Everywhere your money lives."
      actions={
        <Button onClick={openCreate}>
          <Plus /> New account
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Start by adding the account you use most — checking, cash, or a card."
          action={
            <Button onClick={openCreate}>
              <Plus /> New account
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex items-baseline gap-3">
            <span className="text-sm text-muted-foreground">Net total</span>
            <Money
              minor={netWorth}
              tone={netWorth < 0 ? 'expense' : 'neutral'}
              className="text-xl font-semibold"
            />
          </div>
          <section aria-label="Accounts" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={() => {
                  setEditing(account);
                  setFormOpen(true);
                }}
              />
            ))}
          </section>
          {archived.length > 0 && (
            <div className="mt-8">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)}>
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </Button>
              {showArchived && (
                <section
                  aria-label="Archived accounts"
                  className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {archived.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={() => {
                        setEditing(account);
                        setFormOpen(true);
                      }}
                    />
                  ))}
                </section>
              )}
            </div>
          )}
        </>
      )}
      <AccountFormDialog account={editing} open={formOpen} onOpenChange={setFormOpen} />
    </Page>
  );
}
