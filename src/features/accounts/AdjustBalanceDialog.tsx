import { useState } from 'react';
import { toast } from 'sonner';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseSignedAmountInput } from '@/lib/money';
import { adjustmentDelta } from '@/lib/ledger';
import { logError, userMessage } from '@/lib/errors';
import type { Account } from '@/types/domain';
import { useLedger } from '@/app/DataProvider';
import { adjustAccountBalance } from '@/services/finance';

/**
 * "Adjust by record": enter the balance the account SHOULD have; the app posts
 * an outside-of-wallet transfer for the difference, keeping the correction
 * visible in history instead of silently rewriting the balance.
 */
export function AdjustBalanceDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ledger = useLedger();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const targetMinor = parseSignedAmountInput(target);
  const delta =
    targetMinor === null ? null : adjustmentDelta(account.currentBalanceMinor, targetMinor);

  async function apply() {
    if (targetMinor === null || delta === null || delta === 0) return;
    setBusy(true);
    try {
      await adjustAccountBalance(ledger, account, targetMinor);
      toast.success('Balance adjusted');
      onOpenChange(false);
      setTarget('');
    } catch (error) {
      logError('accounts', error);
      toast.error(userMessage(error, 'The adjustment was not saved. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>
            Set what “{account.name}” should hold. The difference is recorded as a transfer
            {delta !== null && delta < 0 ? ' to' : ' from'} outside of wallet, so history stays
            honest.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Current balance: <Money minor={account.currentBalanceMinor} className="text-sm" />
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-target">New balance</Label>
            <Input
              id="adjust-target"
              inputMode="decimal"
              placeholder="0.00"
              className="font-mono"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              aria-invalid={target.trim() !== '' && targetMinor === null}
            />
            {target.trim() !== '' && targetMinor === null && (
              <p role="alert" className="text-xs text-destructive">
                Enter a valid amount, like 1250.00 or -80.00
              </p>
            )}
          </div>
          {delta !== null && delta !== 0 && (
            <p className="text-sm">
              Will record <Money minor={delta} signed tone="auto" className="text-sm" /> from{' '}
              {delta > 0 ? 'outside of wallet into' : 'the account out to'} outside of wallet.
            </p>
          )}
          {delta === 0 && target.trim() !== '' && (
            <p className="text-sm text-muted-foreground">
              The balance already matches — nothing to record.
            </p>
          )}
          <Button onClick={() => void apply()} disabled={busy || delta === null || delta === 0}>
            Record adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
