import { describe, expect, it } from 'vitest';
import { evaluateAmountExpression, isExpression } from '@/lib/calculator';

describe('evaluateAmountExpression', () => {
  it('evaluates plain amounts', () => {
    expect(evaluateAmountExpression('12.50')).toBe(1250);
    expect(evaluateAmountExpression('$1,000')).toBe(100000);
  });

  it('adds and subtracts exactly in cents', () => {
    expect(evaluateAmountExpression('10+2.50')).toBe(1250);
    expect(evaluateAmountExpression('20-0.01')).toBe(1999);
    expect(evaluateAmountExpression('1+2+3')).toBe(600);
    expect(evaluateAmountExpression('0.10+0.20')).toBe(30);
  });

  it('applies × and ÷ before + and −', () => {
    expect(evaluateAmountExpression('5+3×2')).toBe(1100);
    expect(evaluateAmountExpression('10-6÷2')).toBe(700);
    expect(evaluateAmountExpression('2×3+1')).toBe(700);
  });

  it('rounds × and ÷ to the nearest cent', () => {
    expect(evaluateAmountExpression('10÷3')).toBe(333);
    expect(evaluateAmountExpression('0.10×0.10')).toBe(1);
    expect(evaluateAmountExpression('99.99×3')).toBe(29997);
  });

  it('accepts * / x aliases', () => {
    expect(evaluateAmountExpression('4*2')).toBe(800);
    expect(evaluateAmountExpression('8/2')).toBe(400);
    expect(evaluateAmountExpression('4x2')).toBe(800);
  });

  it('rejects incomplete or invalid expressions', () => {
    expect(evaluateAmountExpression('')).toBeNull();
    expect(evaluateAmountExpression('5+')).toBeNull();
    expect(evaluateAmountExpression('+5')).toBeNull();
    expect(evaluateAmountExpression('5++2')).toBeNull();
    expect(evaluateAmountExpression('abc')).toBeNull();
    expect(evaluateAmountExpression('5÷0')).toBeNull();
  });
});

describe('isExpression', () => {
  it('detects operators but not plain amounts', () => {
    expect(isExpression('5+2')).toBe(true);
    expect(isExpression('5×2')).toBe(true);
    expect(isExpression('10-2')).toBe(true);
    expect(isExpression('12.50')).toBe(false);
    expect(isExpression('$1,250')).toBe(false);
  });
});
