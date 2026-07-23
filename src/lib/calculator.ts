import { parseAmountInput } from '@/lib/money';

/**
 * Amount-field calculator: evaluates "12.50+3×2" style expressions in integer
 * cents (+ − exact; × ÷ round to the nearest cent). No parentheses — same as a
 * pocket calculator with precedence. Returns cents, or null when incomplete
 * or invalid.
 */

type Token = { kind: 'value'; cents: number } | { kind: 'op'; op: '+' | '-' | '*' | '/' };

const OP_ALIASES: Record<string, Token & { kind: 'op' }> = {
  '+': { kind: 'op', op: '+' },
  '-': { kind: 'op', op: '-' },
  '−': { kind: 'op', op: '-' },
  '*': { kind: 'op', op: '*' },
  '×': { kind: 'op', op: '*' },
  x: { kind: 'op', op: '*' },
  '/': { kind: 'op', op: '/' },
  '÷': { kind: 'op', op: '/' },
};

function tokenize(expression: string): Token[] | null {
  const text = expression.replace(/[$,\s]/g, '');
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    const op = OP_ALIASES[char];
    if (op) {
      tokens.push(op);
      index += 1;
      continue;
    }
    const match = /^\d+(?:\.\d{1,2})?/.exec(text.slice(index));
    if (!match) return null;
    const cents = parseAmountInput(match[0]);
    if (cents === null) return null;
    tokens.push({ kind: 'value', cents });
    index += match[0].length;
  }
  return tokens;
}

function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Evaluate an amount expression to cents. Null when invalid/incomplete/÷0. */
export function evaluateAmountExpression(expression: string): number | null {
  const tokens = tokenize(expression);
  if (!tokens || tokens.length === 0) return null;
  // must alternate value/op and end on a value
  if (tokens.length % 2 === 0) return null;
  for (const [index, token] of tokens.entries()) {
    if ((index % 2 === 0) !== (token.kind === 'value')) return null;
  }

  // pass 1: × and ÷
  const flat: Token[] = [];
  for (const token of tokens) {
    const previousOp = flat[flat.length - 1];
    if (
      token.kind === 'value' &&
      previousOp?.kind === 'op' &&
      (previousOp.op === '*' || previousOp.op === '/')
    ) {
      flat.pop();
      const left = flat.pop() as Token & { kind: 'value' };
      if (previousOp.op === '*') {
        // cents × cents: one factor is a scalar in cents → divide the scale back out
        flat.push({ kind: 'value', cents: roundHalfUp((left.cents * token.cents) / 100) });
      } else {
        if (token.cents === 0) return null;
        flat.push({ kind: 'value', cents: roundHalfUp((left.cents * 100) / token.cents) });
      }
    } else {
      flat.push(token);
    }
  }

  // pass 2: + and −, left to right, exact
  let result = (flat[0] as Token & { kind: 'value' }).cents;
  for (let index = 1; index < flat.length; index += 2) {
    const op = flat[index] as Token & { kind: 'op' };
    const value = flat[index + 1] as Token & { kind: 'value' };
    result = op.op === '+' ? result + value.cents : result - value.cents;
  }
  return Number.isSafeInteger(result) ? result : null;
}

/** True when the text contains a calculator operator (so it needs evaluating). */
export function isExpression(text: string): boolean {
  return /[+*/×÷−]|(?!^)-/.test(text.replace(/[$,\s]/g, ''));
}
