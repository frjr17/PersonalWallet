import { balanceEffect } from '@/lib/money';
import type { Transaction, TransactionType } from '@/types/domain';

/**
 * Pure balance-delta math — the single source of truth for how transactions
 * move account balances. The finance service turns these maps into atomic
 * Firestore batches; tests exercise them directly.
 */

type Leg = Pick<Transaction, 'type' | 'amountMinor' | 'accountId' | 'destinationAccountId'>;

/** Effect of one stored transaction document on its own account's balance. */
export function legEffect(txn: Pick<Leg, 'type' | 'amountMinor' | 'destinationAccountId'>): number {
  const role = txn.type === 'transfer' && !txn.destinationAccountId ? 'destination' : 'source';
  return balanceEffect(txn.type, txn.amountMinor, role);
}

/** Per-account balance deltas. Zero entries are dropped so no-ops write nothing. */
export type BalanceDeltaMap = Map<string, number>;

function add(map: BalanceDeltaMap, accountId: string, delta: number): BalanceDeltaMap {
  const next = (map.get(accountId) ?? 0) + delta;
  if (next === 0) map.delete(accountId);
  else map.set(accountId, next);
  return map;
}

export interface EntryLike {
  type: Exclude<TransactionType, 'transfer'>;
  accountId: string;
  amountMinor: number;
}

export function createEntryDeltas(entry: EntryLike): BalanceDeltaMap {
  return add(new Map(), entry.accountId, balanceEffect(entry.type, entry.amountMinor));
}

/** Edit = reverse the original effect, then apply the new one. */
export function editEntryDeltas(original: Leg, next: EntryLike): BalanceDeltaMap {
  const deltas = add(new Map(), original.accountId, -legEffect(original));
  return add(deltas, next.accountId, balanceEffect(next.type, next.amountMinor));
}

/** Deleting reverses every provided leg (one entry, or both legs of a transfer). */
export function deleteDeltas(legs: Leg[]): BalanceDeltaMap {
  const deltas: BalanceDeltaMap = new Map();
  for (const leg of legs) add(deltas, leg.accountId, -legEffect(leg));
  return deltas;
}

export interface TransferLike {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
}

export function createTransferDeltas(transfer: TransferLike): BalanceDeltaMap {
  const deltas = add(new Map(), transfer.sourceAccountId, -transfer.amountMinor);
  return add(deltas, transfer.destinationAccountId, transfer.amountMinor);
}

export function editTransferDeltas(oldLegs: Leg[], next: TransferLike): BalanceDeltaMap {
  const deltas = deleteDeltas(oldLegs);
  add(deltas, next.sourceAccountId, -next.amountMinor);
  return add(deltas, next.destinationAccountId, next.amountMinor);
}
