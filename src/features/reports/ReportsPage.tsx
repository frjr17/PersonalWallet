import { format } from 'date-fns';
import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useData } from '@/app/DataProvider';
import { asDate } from '@/lib/dates';
import { dashboardMetrics } from '@/services/finance';
import { downloadJson } from '@/services/backup';
import { formatMoney } from '@/lib/money';
export function ReportsPage() {
  const { transactions, categories } = useData(),
    metrics = dashboardMetrics(transactions);
  const days = Array.from({ length: 31 }, (_, i) => {
    const through = transactions.filter((t) => asDate(t.occurredAt).getDate() <= i + 1);
    return { day: i + 1, net: dashboardMetrics(through).net / 100 };
  });
  const exportCsv = () => {
    const header = 'date,type,description,category,amount_minor\n';
    const rows = transactions
      .map((t) =>
        [
          format(asDate(t.occurredAt), 'yyyy-MM-dd'),
          t.type,
          JSON.stringify(t.description),
          JSON.stringify(categories.find((c) => c.id === t.categoryId)?.name ?? ''),
          t.amountMinor,
        ].join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Page
      eyebrow="Selected month"
      title="Reports"
      action={
        <Button onClick={exportCsv}>
          <Download size={18} />
          Export CSV
        </Button>
      }
    >
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Net cash flow" value={formatMoney(metrics.net)} />
        <Metric label="Savings rate" value={`${metrics.savingsRate}%`} />
        <Metric
          label="Entries analyzed"
          value={String(transactions.filter((t) => t.type !== 'transfer').length)}
        />
      </div>
      <Card>
        <h2 className="font-display text-xl">Cash-flow path</h2>
        <p className="mt-1 text-sm opacity-55">
          Cumulative income less expenses. Transfers are excluded.
        </p>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days}>
              <defs>
                <linearGradient id="jade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#176B5B" stopOpacity=".35" />
                  <stop offset="1" stopColor="#176B5B" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Area dataKey="net" stroke="#176B5B" strokeWidth={3} fill="url(#jade)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Page>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <p className="amount mt-3 text-3xl font-semibold">{value}</p>
    </Card>
  );
}
void downloadJson;
