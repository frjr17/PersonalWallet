import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  applyCalculatorKey,
  CalculatorError,
  normalizeCalculatorInput,
  type CalculatorKey,
} from '@/lib/calculator';
import { cn } from '@/lib/utils';

interface AmountCalculatorProps {
  value: string;
  onChange: (value: string) => void;
}

const amountPattern = /^\d+(?:\.\d{0,2})?$/;

const keys: ReadonlyArray<{
  key: CalculatorKey;
  label: string;
  accessibleLabel: string;
  treatment: 'digit' | 'operator' | 'utility' | 'equals';
  className?: string;
}> = [
  { key: 'clear', label: 'AC', accessibleLabel: 'Clear calculator', treatment: 'utility' },
  { key: 'backspace', label: '⌫', accessibleLabel: 'Backspace', treatment: 'utility' },
  { key: '÷', label: '÷', accessibleLabel: 'Divide', treatment: 'operator' },
  { key: '×', label: '×', accessibleLabel: 'Multiply', treatment: 'operator' },
  { key: '7', label: '7', accessibleLabel: '7', treatment: 'digit' },
  { key: '8', label: '8', accessibleLabel: '8', treatment: 'digit' },
  { key: '9', label: '9', accessibleLabel: '9', treatment: 'digit' },
  { key: '−', label: '−', accessibleLabel: 'Subtract', treatment: 'operator' },
  { key: '4', label: '4', accessibleLabel: '4', treatment: 'digit' },
  { key: '5', label: '5', accessibleLabel: '5', treatment: 'digit' },
  { key: '6', label: '6', accessibleLabel: '6', treatment: 'digit' },
  { key: '+', label: '+', accessibleLabel: 'Add', treatment: 'operator' },
  { key: '1', label: '1', accessibleLabel: '1', treatment: 'digit' },
  { key: '2', label: '2', accessibleLabel: '2', treatment: 'digit' },
  { key: '3', label: '3', accessibleLabel: '3', treatment: 'digit' },
  {
    key: '=',
    label: '=',
    accessibleLabel: 'Equals',
    treatment: 'equals',
    className: 'row-span-2 h-auto',
  },
  {
    key: '0',
    label: '0',
    accessibleLabel: '0',
    treatment: 'digit',
    className: 'col-span-2',
  },
  { key: '.', label: '.', accessibleLabel: 'Decimal point', treatment: 'digit' },
];

const treatmentClasses = {
  digit:
    'border bg-white/80 text-ink hover:bg-white dark:bg-[#151515] dark:text-[#f7f2e8] dark:hover:bg-[#202020]',
  operator:
    'border border-jade/25 bg-mist/75 text-jade hover:bg-mist dark:border-jade/45 dark:bg-jade/15 dark:text-[#7fd5c2] dark:hover:bg-jade/25',
  utility:
    'border border-apricot/25 bg-apricot/10 text-ink hover:bg-apricot/20 dark:border-apricot/35 dark:text-[#f7f2e8]',
  equals: 'bg-jade text-white hover:bg-[#125849]',
} as const;

function keyboardKey(key: string): CalculatorKey | undefined {
  if (/^\d$/.test(key)) return key as CalculatorKey;
  if (key === '.') return '.';
  if (key === '+') return '+';
  if (key === '-') return '−';
  if (key === '*') return '×';
  if (key === '/') return '÷';
  if (key === '=' || key === 'Enter') return '=';
  if (key === 'Backspace') return 'backspace';
  if (key === 'Escape' || key === 'Delete') return 'clear';
  return undefined;
}

export function AmountCalculator({ value, onChange }: AmountCalculatorProps) {
  const [expression, setExpression] = useState(value);
  const [error, setError] = useState<string>();
  const [hasResult, setHasResult] = useState(false);
  const lastEmittedValue = useRef<string | undefined>(undefined);
  const errorId = useId();

  useEffect(() => {
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = undefined;
      return;
    }
    setExpression(value);
    setHasResult(false);
  }, [value]);

  function press(key: CalculatorKey) {
    try {
      const startsNewCalculation = hasResult && (/^\d$/.test(key) || key === '.');
      const source = startsNewCalculation ? '' : expression;
      const next = applyCalculatorKey(source, key);
      const isResult = key === '=';

      setExpression(next);
      setHasResult(isResult);
      setError(undefined);

      if (isResult || next === '' || amountPattern.test(next)) {
        lastEmittedValue.current = next;
        onChange(next);
      } else {
        // An unfinished expression is not a valid transaction amount. Clearing the
        // emitted value prevents saving a stale operand before Equals is pressed.
        lastEmittedValue.current = '';
        onChange('');
      }
    } catch (caught) {
      setError(
        caught instanceof CalculatorError
          ? caught.message
          : 'The calculation could not be completed.',
      );
    }
  }

  function handleExpressionChange(event: ChangeEvent<HTMLInputElement>) {
    try {
      const next = normalizeCalculatorInput(event.currentTarget.value);
      setExpression(next);
      setHasResult(false);
      setError(undefined);

      if (next === '' || amountPattern.test(next)) {
        lastEmittedValue.current = next;
        onChange(next);
      } else {
        lastEmittedValue.current = '';
        onChange('');
      }
    } catch (caught) {
      setError(
        caught instanceof CalculatorError
          ? caught.message
          : 'The calculation could not be completed.',
      );
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = keyboardKey(event.key);
    if (!key) return;

    if (event.target instanceof HTMLInputElement) {
      if (key === '=' || event.key === 'Escape') {
        event.preventDefault();
        press(key);
      }
      return;
    }

    // Preserve native Enter activation when focus is already on a keypad button.
    if (event.key === 'Enter') return;
    event.preventDefault();
    press(key);
  }

  const inputId = useId();

  return (
    <section
      aria-label="Amount calculator"
      aria-describedby={error ? errorId : undefined}
      className="rounded-[1.35rem] border bg-oat/55 p-3 dark:bg-black"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-3 min-h-[5.5rem] rounded-2xl border bg-white/80 px-4 py-3 text-right focus-within:border-jade focus-within:ring-2 focus-within:ring-jade/25 dark:bg-[#0b0b0b]">
        <label className="eyebrow mb-2 block" htmlFor={inputId}>
          Calculate amount
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          value={expression}
          placeholder="0"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="amount block min-h-8 w-full border-0 bg-transparent p-0 text-right text-2xl font-semibold leading-8 placeholder:text-ink/35 focus-visible:ring-0 dark:placeholder:text-white/35"
          onChange={handleExpressionChange}
        />
        <output aria-live="polite" className="sr-only">
          {hasResult ? `Calculated amount ${expression}` : ''}
        </output>
      </div>

      <p
        id={errorId}
        role={error ? 'alert' : undefined}
        className={cn('mb-2 min-h-5 px-1 text-sm font-semibold text-apricot', !error && 'sr-only')}
      >
        {error ?? 'Calculator ready'}
      </p>

      <div className="grid grid-cols-4 gap-2" aria-label="Calculator keypad">
        {keys.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.accessibleLabel}
            className={cn(
              'amount h-12 rounded-xl text-lg font-semibold transition active:scale-[.97] disabled:opacity-50',
              'focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 focus-visible:ring-offset-oat',
              treatmentClasses[item.treatment],
              item.className,
            )}
            onClick={() => press(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
