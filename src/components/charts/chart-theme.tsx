import { Money } from '@/components/money';

/** Validated categorical palette (see index.css). Assign in fixed order, never cycle. */
export const categoricalColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export const incomeColor = 'var(--chart-income)';
export const expenseColor = 'var(--chart-expense)';
export const otherColor = 'var(--chart-other)';

/** Recessive axis defaults: quiet ticks, no axis lines. */
export const axisDefaults = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
} as const;

export const gridDefaults = {
  stroke: 'var(--border)',
  vertical: false,
} as const;

/** Compact axis ticks for minor-unit values: 150000 → "$1.5K". Display only. */
export function moneyTick(minor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

interface TooltipItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

/** Popover-styled tooltip; values in ledger mono via <Money>. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {label != null && label !== '' && (
        <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      )}
      <ul className="grid gap-0.5">
        {payload.map((item) => (
          <li key={item.dataKey ?? item.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <Money minor={Math.round(Number(item.value ?? 0))} className="ml-auto pl-3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
