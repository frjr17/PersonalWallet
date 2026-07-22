import { describe, expect, it } from 'vitest';
import {
  applyCalculatorKey,
  CalculatorError,
  evaluateCalculatorExpression,
  normalizeCalculatorInput,
} from '@/lib/calculator';
import { parseMoney } from '@/lib/money';

describe('calculator', () => {
  it('calculates decimal amounts without binary floating-point drift', () => {
    expect(evaluateCalculatorExpression('0.10 + 0.20')).toBe('0.3');
    expect(parseMoney(evaluateCalculatorExpression('0.10 + 0.20'))).toBe(30);
  });

  it('applies normal operator precedence with keypad symbols', () => {
    expect(evaluateCalculatorExpression('10 + 2 × 3')).toBe('16');
    expect(evaluateCalculatorExpression('20 − 6 ÷ 4')).toBe('18.5');
  });

  it('rounds a division once to a parseable cent value', () => {
    expect(evaluateCalculatorExpression('10 ÷ 3')).toBe('3.33');
    expect(evaluateCalculatorExpression('2 ÷ 3')).toBe('0.67');
  });

  it('reports division by zero in plain language', () => {
    expect(() => evaluateCalculatorExpression('12 ÷ 0')).toThrow('Cannot divide by zero.');
  });

  it('rejects unfinished, non-positive, and unsafe results', () => {
    expect(() => evaluateCalculatorExpression('12 +')).toThrow(
      'Finish the calculation before using the result.',
    );
    expect(() => evaluateCalculatorExpression('10 − 10')).toThrow(
      'The result must be greater than zero',
    );
    expect(() => evaluateCalculatorExpression('90071992547409.91 + 0.01')).toThrow(
      'The result is too large',
    );
  });

  it('exposes stable error codes for calculator consumers', () => {
    try {
      evaluateCalculatorExpression('1 ÷ 0');
      throw new Error('Expected the expression to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(CalculatorError);
      expect((error as CalculatorError).code).toBe('divide-by-zero');
    }
  });

  it('builds keypad expressions while limiting each number to cents', () => {
    let expression = '';
    for (const key of ['1', '2', '.', '3', '4', '5', '+', '2'] as const) {
      expression = applyCalculatorKey(expression, key);
    }
    expect(expression).toBe('12.34+2');
    expect(applyCalculatorKey(expression, '=')).toBe('14.34');
  });

  it('supports operator replacement, backspace, and clear', () => {
    expect(applyCalculatorKey('12+', '×')).toBe('12×');
    expect(applyCalculatorKey('12.3', 'backspace')).toBe('12.');
    expect(applyCalculatorKey('12.3', 'clear')).toBe('');
  });

  it('normalizes typed expressions and formatted pasted amounts', () => {
    expect(normalizeCalculatorInput(' 1,234.50 + .25 ')).toBe('1234.50+0.25');
    expect(normalizeCalculatorInput('12.50 x 2')).toBe('12.50×2');
    expect(() => normalizeCalculatorInput('12.345')).toThrow(
      'Enter numbers with no more than two decimal places.',
    );
  });
});
