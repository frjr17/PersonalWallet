import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMonthLabel, monthKey, shiftMonthKey } from '@/lib/dates';
import { useLedger, useSettings } from '@/app/DataProvider';

/** Shared month navigation. Every month-scoped page reads the same selection. */
export function MonthSwitcher() {
  const { month, setMonth } = useLedger();
  const { settings } = useSettings();
  const currentMonth = monthKey(new Date());

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous month"
        onClick={() => setMonth(shiftMonthKey(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center font-display text-sm font-semibold" aria-live="polite">
        {formatMonthLabel(month, settings.locale)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next month"
        onClick={() => setMonth(shiftMonthKey(month, 1))}
      >
        <ChevronRight />
      </Button>
      {month !== currentMonth && (
        <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth)}>
          Today
        </Button>
      )}
    </div>
  );
}
