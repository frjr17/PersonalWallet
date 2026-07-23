import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { logError, userMessage } from '@/lib/errors';
import type { Account } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { countAccountRecords, deleteAccount } from '@/services/finance';

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
  onDeleted,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { uid } = useLedger();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setCount(null);
    countAccountRecords(uid, account.id)
      .then(setCount)
      .catch((error) => logError('accounts', error));
  }, [open, uid, account.id]);

  async function remove() {
    try {
      await deleteAccount(uid, account);
      toast.success(`Deleted “${account.name}”`);
      onDeleted?.();
    } catch (error) {
      logError('accounts', error);
      toast.error(userMessage(error, 'The account was not deleted. Try again.'));
    }
  }

  return (
    <ConfirmDialog
      title={`Delete “${account.name}”?`}
      description={`${
        count === null ? 'Its' : `Its ${count}`
      } transaction${count === 1 ? '' : 's'} and recurring templates are deleted with it. Transfers with other accounts stay there as outside-of-wallet records, so other balances don't change. This cannot be undone — prefer Archive to keep history.`}
      confirmLabel="Delete account"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => void remove()}
    />
  );
}
