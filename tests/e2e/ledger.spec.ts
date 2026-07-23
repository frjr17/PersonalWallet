import { expect, test, type Page } from '@playwright/test';

/**
 * Full ledger workflow against the emulator suite. Tests run serially and
 * build on each other's state (single worker, see playwright.config.ts).
 */

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /emulator owner/i }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

async function dismissOfflineNotice(page: Page) {
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible().catch(() => false)) await notice.click();
}

/** In-app navigation (not page.goto) so the form's history-back stays an SPA transition. */
async function openNewTransaction(page: Page) {
  await page.getByRole('button', { name: 'New transaction' }).first().click();
  await expect(page.getByRole('heading', { name: 'New transaction' })).toBeVisible();
}

test('login screen renders only the allowed sign-in options', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /emulator owner/i })).toBeVisible();
  await expect(page.getByText(/sign up|register/i)).toHaveCount(0);
});

test('owner can create an account', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'New account' }).first().click();
  await page.getByLabel('Account name').fill('E2E Wallet');
  await page.getByLabel('Opening balance').fill('100.00');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Account created')).toBeVisible();
  const card = page.locator('article, div').filter({ hasText: 'E2E Wallet' });
  await expect(page.getByText('E2E Wallet')).toBeVisible();
  await expect(card.getByText('$100.00').first()).toBeVisible();
});

test('owner can record an expense that moves the balance', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await openNewTransaction(page);
  await page.getByLabel('Amount').fill('12.50');
  await page.getByLabel('Account').click();
  await page.getByRole('option', { name: 'E2E Wallet' }).click();
  await page.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Groceries', exact: true }).click();
  await page.getByLabel('Description').fill('E2E groceries');
  await page.getByRole('button', { name: 'Record expense' }).click();
  await expect(page.getByText('Expense recorded')).toBeVisible();

  await page.goto('/accounts');
  await expect(page.getByText('$87.50').first()).toBeVisible();
});

test('owner can record income', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await openNewTransaction(page);
  await page.getByRole('tab', { name: 'Income' }).click();
  await page.getByLabel('Amount').fill('50.00');
  await page.getByLabel('Account').click();
  await page.getByRole('option', { name: 'E2E Wallet' }).click();
  await page.getByLabel('Description').fill('E2E refund');
  await page.getByRole('button', { name: 'Record income' }).click();
  await expect(page.getByText('Income recorded')).toBeVisible();

  await page.goto('/accounts');
  await expect(page.getByText('$137.50').first()).toBeVisible();
});

test('owner can transfer between accounts atomically', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await openNewTransaction(page);
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await page.getByLabel('Amount').fill('37.50');
  await page.getByLabel('From account').click();
  await page.getByRole('option', { name: 'E2E Wallet' }).click();
  await page.getByLabel('To account').click();
  await page.getByRole('option', { name: 'Savings' }).click();
  await page.getByRole('button', { name: 'Record transfer' }).click();
  await expect(page.getByText('Transfer recorded')).toBeVisible();

  await page.goto('/accounts');
  await expect(page.getByText('$100.00').first()).toBeVisible(); // 137.50 − 37.50
});

test('owner can edit and delete a transaction with balance integrity', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await page.goto('/transactions');
  await page
    .getByRole('button', { name: /E2E groceries/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Edit transaction' })).toBeVisible();
  await page.getByLabel('Amount').fill('20.00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Transaction updated')).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText('$92.50').first()).toBeVisible(); // 100 − (20 − 12.50)

  await page.goto('/transactions');
  await page
    .getByRole('button', { name: /E2E refund/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByText('Transaction deleted')).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText('$42.50').first()).toBeVisible(); // 92.50 − 50
});

test('owner can create a budget and see usage', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'New budget' }).first().click();
  await page.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Restaurants' }).click();
  await page.getByLabel('Monthly limit').fill('200.00');
  await page.getByRole('button', { name: 'Create budget' }).click();
  await expect(page.getByText('Budget created')).toBeVisible();
  await expect(page.getByText('Restaurants')).toBeVisible();
  await expect(page.getByText('$200.00').first()).toBeVisible();
});

test('owner can export a JSON backup', async ({ page }) => {
  await signIn(page);
  await dismissOfflineNotice(page);
  await page.goto('/settings/backup');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/pocket-ledger-.*\.backup\.json/);
  await expect(page.getByText('Backup downloaded')).toBeVisible();
});
