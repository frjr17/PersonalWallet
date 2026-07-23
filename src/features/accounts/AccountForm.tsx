import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { minorToInputString, parseAmountInput, parseSignedAmountInput } from '@/lib/money';
import { logError, userMessage } from '@/lib/errors';
import { accountTypeSchema, type Account, type AccountType } from '@/types/domain';
import { useLedger, useSettings } from '@/app/DataProvider';
import { createAccount, updateAccount } from '@/services/repositories';
import { accountTypeMeta } from '@/features/accounts/accountMeta';

const accountFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the account a name'),
  type: accountTypeSchema,
  openingBalance: z
    .string()
    .refine((value) => parseSignedAmountInput(value) !== null, 'Enter a valid amount, like 250.00'),
  creditLimit: z
    .string()
    .refine(
      (value) => value.trim() === '' || (parseAmountInput(value) ?? 0) > 0,
      'Enter a limit greater than zero, or leave it empty',
    ),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

export function AccountFormDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uid } = useLedger();
  const { settings } = useSettings();
  const editing = Boolean(account);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    values: {
      name: account?.name ?? '',
      type: account?.type ?? 'checking',
      openingBalance: account ? minorToInputString(account.openingBalanceMinor) : '0.00',
      creditLimit: account?.creditLimitMinor ? minorToInputString(account.creditLimitMinor) : '',
    },
  });
  const type = form.watch('type');

  async function onSubmit(values: AccountFormValues) {
    const input = {
      name: values.name,
      type: values.type,
      currency: account?.currency ?? settings.currency,
      openingBalanceMinor: parseSignedAmountInput(values.openingBalance)!,
      creditLimitMinor:
        values.type === 'credit-card' && values.creditLimit.trim() !== ''
          ? parseAmountInput(values.creditLimit)!
          : undefined,
    };
    try {
      if (account) {
        await updateAccount(uid, account, input);
        toast.success('Account updated');
      } else {
        await createAccount(uid, input);
        toast.success('Account created');
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      logError('accounts', error);
      toast.error(userMessage(error, 'The account was not saved. Try again.'));
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit account' : 'New account'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Changing the opening balance shifts the current balance by the same amount.'
              : 'Add a place your money lives — an account, card, or cash envelope.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-type">Type</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(value) => form.setValue('type', value as AccountType)}
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(accountTypeMeta).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-opening">Opening balance</Label>
            <Input
              id="account-opening"
              inputMode="decimal"
              className="font-mono"
              aria-invalid={Boolean(errors.openingBalance)}
              aria-describedby="account-opening-hint"
              {...form.register('openingBalance')}
            />
            <p id="account-opening-hint" className="text-xs text-muted-foreground">
              What the account held before its first recorded transaction. Negative is fine for
              cards and loans.
            </p>
            {errors.openingBalance && (
              <p role="alert" className="text-xs text-destructive">
                {errors.openingBalance.message}
              </p>
            )}
          </div>
          {type === 'credit-card' && (
            <div className="grid gap-1.5">
              <Label htmlFor="account-limit">Credit limit (optional)</Label>
              <Input
                id="account-limit"
                inputMode="decimal"
                placeholder="1500.00"
                className="font-mono"
                aria-invalid={Boolean(errors.creditLimit)}
                aria-describedby="account-limit-hint"
                {...form.register('creditLimit')}
              />
              <p id="account-limit-hint" className="text-xs text-muted-foreground">
                Used to show how much of the card is available and how close you are to the limit.
              </p>
              {errors.creditLimit && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.creditLimit.message}
                </p>
              )}
            </div>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {editing ? 'Save changes' : 'Create account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
