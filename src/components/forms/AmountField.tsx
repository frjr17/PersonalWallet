import { Delete, Equal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/money';
import { evaluateAmountExpression, isExpression } from '@/lib/calculator';
import { minorToInputString } from '@/lib/money';
import { cn } from '@/lib/utils';

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '+'] as const;

/**
 * Amount input with a built-in calculator: type or tap "24.99+12×2", see the
 * live result, and press = (or just submit) to use it. All math is integer cents.
 */
export function AmountField({
  id,
  value,
  onChange,
  invalid,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  const expression = isExpression(value);
  const result = expression ? evaluateAmountExpression(value) : null;

  function collapse() {
    if (result !== null && result > 0) onChange(minorToInputString(result));
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          className="h-12 pr-20 font-mono text-2xl"
          aria-invalid={invalid}
          aria-describedby={`${id}-result`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && expression) {
              event.preventDefault();
              collapse();
            }
          }}
        />
        <span
          id={`${id}-result`}
          aria-live="polite"
          className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {expression && (result !== null ? <Money minor={result} className="text-sm" /> : '…')}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Calculator keys">
        {KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-9 font-mono"
            aria-label={key === '.' ? 'Decimal point' : key}
            onClick={() => onChange(value + key)}
          >
            {key}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-9"
          aria-label="Backspace"
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete />
        </Button>
        <Button
          type="button"
          variant={expression ? 'default' : 'outline'}
          className="col-span-4 h-9"
          aria-label="Equals"
          disabled={!expression || result === null || result <= 0}
          onClick={collapse}
        >
          <Equal />
        </Button>
      </div>
    </div>
  );
}
