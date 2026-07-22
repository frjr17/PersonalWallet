import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => 'accounts-collection'),
  deleteField: vi.fn(() => 'delete-field'),
  doc: vi.fn(() => 'account-reference'),
  getDoc: vi.fn(),
  increment: vi.fn((value: number) => ({ increment: value })),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  updateDoc: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  ...firestore,
}));

import { saveAccount } from '@/services/repositories';

describe('account repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('backfills archived when updating a legacy account', async () => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Everyday',
        type: 'checking',
        currency: 'USD',
        openingBalanceMinor: 10_000,
        currentBalanceMinor: 12_000,
      }),
    });

    await saveAccount(
      'owner',
      {
        name: 'Everyday checking',
        type: 'checking',
        currency: 'USD',
        openingBalanceMinor: 11_000,
      },
      'account-id',
    );

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      'account-reference',
      expect.objectContaining({
        archived: false,
        currentBalanceMinor: { increment: 1_000 },
      }),
    );
  });

  it('normalizes a credit-card negative zero before updating Firestore', async () => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Card',
        type: 'credit-card',
        currency: 'USD',
        openingBalanceMinor: 0,
        currentBalanceMinor: 0,
        archived: false,
      }),
    });

    await saveAccount(
      'owner',
      {
        name: 'GB Card',
        type: 'credit-card',
        currency: 'USD',
        openingBalanceMinor: -0,
        creditLimitMinor: 180_000,
      },
      'card-id',
    );

    const update = firestore.updateDoc.mock.calls[0]?.[1] as {
      openingBalanceMinor: number;
    };
    expect(Object.is(update.openingBalanceMinor, -0)).toBe(false);
    expect(update.openingBalanceMinor).toBe(0);
    expect(firestore.increment).toHaveBeenCalledWith(0);
  });
});
