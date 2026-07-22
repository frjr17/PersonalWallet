const MAX_EXPRESSION_LENGTH = 96;
const MONEY_SCALE = 100n;
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

export type CalculatorOperator = '+' | '−' | '×' | '÷';
export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | CalculatorOperator
  | '='
  | 'clear'
  | 'backspace';

export type CalculatorErrorCode =
  | 'divide-by-zero'
  | 'expression-too-long'
  | 'invalid-expression'
  | 'non-positive-result'
  | 'unsafe-result';

export class CalculatorError extends Error {
  readonly code: CalculatorErrorCode;

  constructor(code: CalculatorErrorCode, message: string) {
    super(message);
    this.name = 'CalculatorError';
    this.code = code;
  }
}

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) {
    throw new CalculatorError('divide-by-zero', 'Cannot divide by zero.');
  }
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator) || 1n;
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

function parseDecimal(value: string): Fraction {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) {
    throw new CalculatorError(
      'invalid-expression',
      'Enter numbers with no more than two decimal places.',
    );
  }
  const [whole = '0', decimal = ''] = value.split('.');
  const denominator = 10n ** BigInt(decimal.length);
  return fraction(BigInt(whole) * denominator + BigInt(decimal || '0'), denominator);
}

function add(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction): Fraction {
  if (right.numerator === 0n) {
    throw new CalculatorError('divide-by-zero', 'Cannot divide by zero.');
  }
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function roundToMinorUnits(value: Fraction): bigint {
  const scaledNumerator = value.numerator * MONEY_SCALE;
  let quotient = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  if (absoluteRemainder * 2n >= value.denominator) {
    quotient += scaledNumerator < 0n ? -1n : 1n;
  }
  return quotient;
}

function formatMinorUnits(minorUnits: bigint): string {
  const whole = minorUnits / MONEY_SCALE;
  const cents = minorUnits % MONEY_SCALE;
  if (cents === 0n) return whole.toString();
  if (cents % 10n === 0n) return `${whole}.${cents / 10n}`;
  return `${whole}.${cents.toString().padStart(2, '0')}`;
}

function assertExpressionLength(expression: string): string {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new CalculatorError(
      'expression-too-long',
      'Calculation is too long. Clear it and try a shorter one.',
    );
  }
  return expression;
}

function normalizeNumberLiteral(value: string): string {
  const prepared = value.startsWith('.') ? `0${value}` : value;
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{0,2})?$/.test(prepared)) {
    throw new CalculatorError(
      'invalid-expression',
      'Enter numbers with no more than two decimal places.',
    );
  }
  return prepared.replaceAll(',', '');
}

/**
 * Normalizes a typed or pasted decimal expression for the calculator display.
 * Grouping commas, whitespace, ASCII operators, and a leading decimal point are
 * accepted, while incomplete final operators remain available for continued entry.
 */
export function normalizeCalculatorInput(input: string): string {
  const collapsed = input
    .trim()
    .replace(/\s+/g, '')
    .replaceAll('-', '−')
    .replaceAll('*', '×')
    .replaceAll('/', '÷')
    .replace(/[xX]/g, '×');
  assertExpressionLength(collapsed);
  if (!collapsed) return '';
  if (!/^[\d.,+−×÷]+$/.test(collapsed)) {
    throw new CalculatorError(
      'invalid-expression',
      'Use only numbers, decimals, and the calculator operations.',
    );
  }

  let normalized = '';
  let number = '';
  for (const character of collapsed) {
    const isOperator =
      character === '+' || character === '−' || character === '×' || character === '÷';
    if (!isOperator) {
      number += character;
      continue;
    }
    if (!number) {
      throw new CalculatorError(
        'invalid-expression',
        'Put a number before each calculator operation.',
      );
    }
    normalized += `${normalizeNumberLiteral(number)}${character}`;
    number = '';
  }

  if (number) normalized += normalizeNumberLiteral(number);
  return assertExpressionLength(normalized);
}

function tokenize(expression: string): { values: Fraction[]; operators: CalculatorOperator[] } {
  const values: Fraction[] = [];
  const operators: CalculatorOperator[] = [];
  let start = 0;

  for (let index = 0; index <= expression.length; index += 1) {
    const character = expression[index];
    const isOperator =
      character === '+' || character === '−' || character === '×' || character === '÷';
    if (!isOperator && index < expression.length) continue;

    const number = expression.slice(start, index);
    if (!number) {
      throw new CalculatorError(
        'invalid-expression',
        'Finish the calculation before using the result.',
      );
    }
    values.push(parseDecimal(number));
    if (isOperator) {
      operators.push(character);
      start = index + 1;
    }
  }

  if (values.length !== operators.length + 1) {
    throw new CalculatorError(
      'invalid-expression',
      'Finish the calculation before using the result.',
    );
  }
  return { values, operators };
}

/**
 * Evaluates a calculator expression without using binary floating-point money math.
 * Multiplication and division take precedence, and the final result is rounded half-up
 * to two decimal places before being returned as a value accepted by parseMoney.
 */
export function evaluateCalculatorExpression(expression: string): string {
  const normalized = normalizeCalculatorInput(expression);
  if (!normalized) {
    throw new CalculatorError('invalid-expression', 'Enter an amount to calculate.');
  }

  const { values, operators } = tokenize(normalized);
  const firstValue = values[0];
  if (!firstValue) {
    throw new CalculatorError('invalid-expression', 'Enter an amount to calculate.');
  }
  const terms: Fraction[] = [firstValue];
  const additiveOperators: CalculatorOperator[] = [];

  operators.forEach((operator, index) => {
    const right = values[index + 1];
    if (!right) {
      throw new CalculatorError('invalid-expression', 'The calculation could not be completed.');
    }
    if (operator === '×' || operator === '÷') {
      const left = terms.pop();
      if (!left) {
        throw new CalculatorError('invalid-expression', 'The calculation could not be completed.');
      }
      terms.push(operator === '×' ? multiply(left, right) : divide(left, right));
    } else {
      additiveOperators.push(operator);
      terms.push(right);
    }
  });

  const initialResult = terms[0];
  if (!initialResult) {
    throw new CalculatorError('invalid-expression', 'The calculation could not be completed.');
  }
  let result: Fraction = initialResult;
  additiveOperators.forEach((operator, index) => {
    const right = terms[index + 1];
    if (!right) {
      throw new CalculatorError('invalid-expression', 'The calculation could not be completed.');
    }
    result = operator === '+' ? add(result, right) : subtract(result, right);
  });

  const minorUnits = roundToMinorUnits(result);
  if (minorUnits <= 0n) {
    throw new CalculatorError(
      'non-positive-result',
      'The result must be greater than zero to use as an amount.',
    );
  }
  if (minorUnits > MAX_SAFE_MINOR_UNITS) {
    throw new CalculatorError(
      'unsafe-result',
      'The result is too large to use as a transaction amount.',
    );
  }
  return formatMinorUnits(minorUnits);
}

function currentNumber(expression: string): string {
  return expression.split(/[+−×÷]/).at(-1) ?? '';
}

/** Applies one keypad action and returns the next display expression. */
export function applyCalculatorKey(expression: string, key: CalculatorKey): string {
  const normalized = normalizeCalculatorInput(expression);
  if (key === 'clear') return '';
  if (key === 'backspace') return normalized.slice(0, -1);
  if (key === '=') return evaluateCalculatorExpression(normalized);

  if (key === '+' || key === '−' || key === '×' || key === '÷') {
    if (!normalized) return normalized;
    if (/[+−×÷]$/.test(normalized)) return `${normalized.slice(0, -1)}${key}`;
    return assertExpressionLength(`${normalized}${key}`);
  }

  const activeNumber = currentNumber(normalized);
  if (key === '.') {
    if (activeNumber.includes('.')) return normalized;
    return assertExpressionLength(`${normalized}${activeNumber ? '' : '0'}.`);
  }

  const decimal = activeNumber.split('.')[1];
  if (decimal !== undefined && decimal.length >= 2) return normalized;
  if (activeNumber === '0') return `${normalized.slice(0, -1)}${key}`;

  return assertExpressionLength(`${normalized}${key}`);
}
