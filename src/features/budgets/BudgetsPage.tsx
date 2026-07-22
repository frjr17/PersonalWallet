import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { monthKey } from '@/lib/dates';
import { flattenCategories } from '@/lib/categories';
import { formatMoney, parseMoney } from '@/lib/money';
import { budgetStatus } from '@/services/finance';
import { saveBudget } from '@/services/repositories';
interface Form {
  categoryId: string;
  limit: string;
  threshold: string;
  rollover: boolean;
}
export function BudgetsPage() {
  const { month, budgets, categories, transactions } = useData(),
    { user } = useAuth(),
    [show, setShow] = useState(false);
  const { register, handleSubmit, reset } = useForm<Form>({
    defaultValues: { threshold: '80', rollover: false },
  });
  const expenseCategories = flattenCategories(categories, { type: 'expense' });
  const submit = handleSubmit(async (v) => {
    if (!user) return;
    try {
      await saveBudget(user.uid, {
        categoryId: v.categoryId,
        period: monthKey(month),
        limitMinor: parseMoney(v.limit),
        warningThreshold: Number(v.threshold) / 100,
        rollover: v.rollover,
      });
      toast.success('Budget created');
      reset();
      setShow(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save budget');
    }
  });
  return (
    <Page
      eyebrow={monthKey(month)}
      title="Budgets"
      action={
        <Button onClick={() => setShow((v) => !v)}>
          <Plus size={18} />
          New budget
        </Button>
      }
    >
      {show && (
        <Card className="mb-5">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <label>
              <span className="label">Expense category</span>
              <select className="select" {...register('categoryId', { required: true })}>
                <option value="">Choose</option>
                {expenseCategories.map(({ category, path }) => (
                  <option key={category.id} value={category.id}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Monthly limit</span>
              <input
                className="input amount"
                placeholder="500.00"
                {...register('limit', { required: true })}
              />
            </label>
            <label>
              <span className="label">Warn at %</span>
              <input
                className="input amount"
                type="number"
                min="1"
                max="100"
                {...register('threshold')}
              />
            </label>
            <div className="flex items-center gap-3 md:pt-7">
              <input id="rollover" type="checkbox" {...register('rollover')} />
              <label htmlFor="rollover">Carry unused amount</label>
            </div>
            <Button>Save budget</Button>
          </form>
        </Card>
      )}
      {budgets.length ? (
        <div className="divide-y border-y">
          {budgets.map((b) => {
            const spent = transactions
                .filter((t) => t.type === 'expense' && t.categoryId === b.categoryId)
                .reduce((n, t) => n + t.amountMinor, 0),
              s = budgetStatus(b, spent),
              category = categories.find((c) => c.id === b.categoryId);
            return (
              <section key={b.id} className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center text-jade dark:text-[#67c7b5]">
                      <CategoryIcon icon={category?.icon} size={20} />
                    </span>
                    <div>
                      <p className="font-semibold">{category?.name ?? 'Category'}</p>
                      <p className="amount mt-1 text-xl font-semibold">
                        {formatMoney(s.remaining)}
                      </p>
                      <p className="text-sm opacity-55">
                        remaining of {formatMoney(s.effectiveLimit)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`grid size-14 place-items-center rounded-full font-mono text-sm ${s.state === 'exceeded' ? 'bg-apricot' : s.state === 'warning' ? 'bg-[#f1d19b]' : 'bg-mist'}`}
                  >
                    {Math.round(s.usage)}%
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded bg-mist">
                  <div
                    className={`h-full ${s.state === 'exceeded' ? 'bg-apricot' : 'bg-jade'}`}
                    style={{ width: `${Math.min(100, s.usage)}%` }}
                  />
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Plan the month"
          detail="Create a category budget and see its progress update with every expense."
        />
      )}
    </Page>
  );
}
