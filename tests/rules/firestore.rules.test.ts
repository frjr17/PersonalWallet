// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  const rules = (await readFile('firestore.rules', 'utf8')).replace(
    /request\.auth\.uid == "[^"]+"/,
    'request.auth.uid == "owner-test"',
  );
  testEnv = await initializeTestEnvironment({
    projectId: 'personal-budget-demo',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(() => testEnv.clearFirestore());
afterAll(() => testEnv.cleanup());
const account = {
  name: 'Cash',
  type: 'cash',
  currency: 'USD',
  openingBalanceMinor: 0,
  currentBalanceMinor: 0,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const category = {
  name: 'Groceries',
  type: 'expense',
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
describe('owner-only rules', () => {
  it('denies unauthenticated and other-user access', async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/owner-test/accounts/a')),
    );
    await assertFails(
      setDoc(
        doc(testEnv.authenticatedContext('other').firestore(), 'users/other/accounts/a'),
        account,
      ),
    );
  });
  it('allows valid owner documents', () =>
    assertSucceeds(
      setDoc(
        doc(testEnv.authenticatedContext('owner-test').firestore(), 'users/owner-test/accounts/a'),
        account,
      ),
    ));
  it('allows liability balances and validates credit limits', async () => {
    const owner = testEnv.authenticatedContext('owner-test').firestore();
    await assertSucceeds(
      setDoc(doc(owner, 'users/owner-test/accounts/card'), {
        ...account,
        type: 'credit-card',
        openingBalanceMinor: -12_500,
        currentBalanceMinor: -14_000,
        creditLimitMinor: 100_000,
      }),
    );
    await assertFails(
      setDoc(doc(owner, 'users/owner-test/accounts/bad-card'), {
        ...account,
        type: 'credit-card',
        creditLimitMinor: 0,
      }),
    );
  });
  it('rejects negative zero because account balances must be encoded as integers', async () => {
    const owner = testEnv.authenticatedContext('owner-test').firestore();
    await assertFails(
      setDoc(doc(owner, 'users/owner-test/accounts/negative-zero-card'), {
        ...account,
        type: 'credit-card',
        openingBalanceMinor: -0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(owner, 'users/owner-test/accounts/integer-zero-card'), {
        ...account,
        type: 'credit-card',
        openingBalanceMinor: 0,
      }),
    );
  });
  it('allows an account update to repair a missing legacy archived flag', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const legacyAccount: Omit<typeof account, 'archived'> = {
        name: account.name,
        type: account.type,
        currency: account.currency,
        openingBalanceMinor: account.openingBalanceMinor,
        currentBalanceMinor: account.currentBalanceMinor,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
      await setDoc(doc(context.firestore(), 'users/owner-test/accounts/legacy'), legacyAccount);
    });
    const owner = testEnv.authenticatedContext('owner-test').firestore();
    const reference = doc(owner, 'users/owner-test/accounts/legacy');

    await assertFails(updateDoc(reference, { name: 'Legacy checking' }));
    await assertSucceeds(updateDoc(reference, { name: 'Legacy checking', archived: false }));
  });
  it('rejects invalid money and unknown paths', async () => {
    await assertFails(
      setDoc(
        doc(
          testEnv.authenticatedContext('owner-test').firestore(),
          'users/owner-test/transactions/t',
        ),
        {
          type: 'expense',
          accountId: 'a',
          amountMinor: 0,
          currency: 'USD',
          description: 'bad',
          source: 'manual',
        },
      ),
    );
    await assertFails(
      setDoc(doc(testEnv.authenticatedContext('owner-test').firestore(), 'public/x'), { ok: true }),
    );
  });

  it('allows canonical category icons and rejects arbitrary new icon values', async () => {
    const owner = testEnv.authenticatedContext('owner-test').firestore();
    await assertSucceeds(
      setDoc(doc(owner, 'users/owner-test/categories/valid'), {
        ...category,
        icon: 'groceries',
      }),
    );
    await assertSucceeds(
      setDoc(doc(owner, 'users/owner-test/categories/legacy-missing'), category),
    );
    await assertFails(
      setDoc(doc(owner, 'users/owner-test/categories/invalid'), {
        ...category,
        icon: '<script>',
      }),
    );
  });

  it('allows an unchanged legacy icon while blocking replacement with another arbitrary value', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/owner-test/categories/legacy'), {
        ...category,
        icon: '🍽️',
      });
    });
    const owner = testEnv.authenticatedContext('owner-test').firestore();
    const reference = doc(owner, 'users/owner-test/categories/legacy');
    await assertSucceeds(updateDoc(reference, { archived: true }));
    await assertFails(updateDoc(reference, { icon: '🚀' }));
    await assertSucceeds(updateDoc(reference, { icon: 'dining' }));
  });
});
