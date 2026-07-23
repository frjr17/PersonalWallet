import { useSettingsOptional } from '@/app/DataProvider';
import { cn } from '@/lib/utils';

type Tone = 'auto' | 'income' | 'expense' | 'transfer' | 'neutral';

const toneClass: Record<Exclude<Tone, 'auto'>, string> = {
  income: 'text-income',
  expense: 'text-expense',
  transfer: 'text-transfer',
  neutral: '',
};

/**
 * The passbook amount: tabular mono with small raised cents, in bookkeeping ink —
 * green for money in, red for money out. Every amount in the app renders through this.
 */
export function Money({
  minor,
  tone = 'neutral',
  signed = false,
  className,
}: {
  minor: number;
  tone?: Tone;
  signed?: boolean;
  className?: string;
}) {
  const { currency, locale } = useSettingsOptional();
  const resolvedTone: Exclude<Tone, 'auto'> =
    tone === 'auto' ? (minor > 0 ? 'income' : minor < 0 ? 'expense' : 'neutral') : tone;
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const parts = formatter.formatToParts(Math.abs(minor) / 100);
  const sign = minor < 0 ? '−' : signed && minor > 0 ? '+' : '';

  return (
    <span className={cn('font-mono whitespace-nowrap', toneClass[resolvedTone], className)}>
      {/* Full amount for screen readers; the passbook rendering drops the decimal point. */}
      <span className="sr-only">{sign + formatter.format(Math.abs(minor) / 100)}</span>
      <span aria-hidden="true">
        {sign}
        {parts.map((part, index) =>
          part.type === 'fraction' ? (
            <span key={index} className="align-[0.28em] text-[0.68em] font-medium">
              {part.value}
            </span>
          ) : part.type === 'decimal' ? null : (
            <span key={index}>{part.value}</span>
          ),
        )}
      </span>
    </span>
  );
}
