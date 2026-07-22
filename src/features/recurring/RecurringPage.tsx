import { format } from 'date-fns';
import { Check, Pause, Play, Plus, SkipForward, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { asDate } from '@/lib/dates';
import { flattenCategories } from '@/lib/categories';
import { formatMoney, parseMoney } from '@/lib/money';
import { fingerprint } from '@/services/fingerprint';
import {
  advanceRecurring,
  confirmRecurring,
  deleteRecurring,
  saveRecurring,
  setRecurringActive,
} from '@/services/repositories';
import type { Frequency } from '@/types/domain';
interface Form {
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  frequency: Frequency;
  interval: string;
  nextOccurrence: string;
  endDate: string;
}
export function RecurringPage() {
  const { recurring, accounts, categories } = useData(),
    { user } = useAuth(),
    [show, setShow] = useState(false);
  const { register, watch, handleSubmit, reset } = useForm<Form>({
    defaultValues: {
      type: 'expense',
      frequency: 'monthly',
      interval: '1',
      nextOccurrence: format(new Date(), 'yyyy-MM-dd'),
    },
  });
  const type = watch('type');
  const categoryChoices = flattenCategories(categories, { type });
  const submit = handleSubmit(async (v) => {
    if (!user) return;
    try {
      const date = new Date(`${v.nextOccurrence}T12:00:00`);
      await saveRecurring(user.uid, {
        type: v.type,
        accountId: v.accountId,
        categoryId: v.categoryId,
        amountMinor: parseMoney(v.amount),
        currency: 'USD',
        description: v.description,
        frequency: v.frequency,
        interval: Number(v.interval),
        nextOccurrence: date,
        scheduleAnchorDay: date.getDate(),
        endDate: v.endDate ? new Date(`${v.endDate}T12:00:00`) : undefined,
        active: true,
      });
      toast.success('Recurring item created');
      reset();
      setShow(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save recurring item');
    }
  });
  return (
    <Page
      eyebrow="Manual confirmation"
      title="Recurring"
      action={
        <Button onClick={() => setShow((v) => !v)}>
          <Plus size={18} />
          New recurring
        </Button>
      }
    >
      {show && (
        <Card className="mb-5">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type">
              <select className="select" {...register('type')}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <Field label="Account">
              <select className="select" {...register('accountId', { required: true })}>
                <option value="">Choose</option>
                {accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Category">
              <select className="select" {...register('categoryId', { required: true })}>
                <option value="">Choose</option>
                {categoryChoices.map(({ category, path }) => (
                  <option key={category.id} value={category.id}>
                    {path}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input className="input amount" {...register('amount', { required: true })} />
            </Field>
            <Field label="Description">
              <input className="input" {...register('description', { required: true })} />
            </Field>
            <Field label="Frequency">
              <select className="select" {...register('frequency')}>
                <option>weekly</option>
                <option>biweekly</option>
                <option>monthly</option>
                <option>yearly</option>
              </select>
            </Field>
            <Field label="Every">
              <input className="input" type="number" min="1" {...register('interval')} />
            </Field>
            <Field label="Next date">
              <input className="input" type="date" {...register('nextOccurrence')} />
            </Field>
            <Button>Save recurring item</Button>
          </form>
        </Card>
      )}
      {recurring.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {recurring.map((r) => (
            <Card key={r.id} className={!r.active ? 'opacity-60' : ''}>
              <div className="flex justify-between">
                <div>
                  <p className="eyebrow">
                    {r.frequency} · {r.type}
                  </p>
                  <h2 className="mt-2 font-display text-xl">{r.description}</h2>
                  <p className="amount mt-2 text-2xl">{formatMoney(r.amountMinor, r.currency)}</p>
                  <p className="mt-1 text-sm opacity-55">
                    Next {format(asDate(r.nextOccurrence), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex h-fit gap-1">
                  <Button
                    variant="ghost"
                    aria-label={r.active ? 'Pause' : 'Resume'}
                    onClick={() => user && void setRecurringActive(user.uid, r.id, !r.active)}
                  >
                    {r.active ? <Pause size={17} /> : <Play size={17} />}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" aria-label="Delete">
                        <Trash2 size={17} />
                      </Button>
                    }
                    title="Delete recurring item?"
                    description="Posted transactions remain in your ledger."
                    onConfirm={() => (user ? deleteRecurring(user.uid, r.id) : Promise.resolve())}
                  />
                </div>
              </div>
              {r.active && asDate(r.nextOccurrence) <= new Date() && (
                <div className="mt-5 flex gap-2 border-t pt-4">
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      const hash = await fingerprint(
                        r.accountId,
                        asDate(r.nextOccurrence),
                        r.amountMinor,
                        r.description,
                      );
                      await confirmRecurring(user.uid, r, hash);
                      toast.success('Occurrence posted');
                    }}
                  >
                    <Check size={17} />
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => user && void advanceRecurring(user.uid, r)}
                  >
                    <SkipForward size={17} />
                    Skip
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing repeats yet"
          detail="Add recurring income or expenses. Due items wait for your confirmation."
        />
      )}
    </Page>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
