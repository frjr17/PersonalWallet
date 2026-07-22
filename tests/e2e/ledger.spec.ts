import { test, expect } from '@playwright/test';
async function enterAmount(page: import('@playwright/test').Page, value: string) {
  await page.getByRole('button', { name: 'Clear calculator' }).click();
  for (const character of value) {
    await page
      .getByRole('button', {
        name: character === '.' ? 'Decimal point' : character,
        exact: true,
      })
      .click();
  }
}
test('login screen renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /emulator owner/i })).toBeVisible();
});
test('a zero-opening credit card can be created and edited', async ({ page }, testInfo) => {
  const accountName = `${testInfo.project.name} Zero card`;
  await page.goto('/login');
  await page.getByRole('button', { name: /emulator owner/i }).click();
  await expect(page.getByRole('link', { name: 'Accounts' }).last()).toBeVisible();

  await page.goto('/accounts');
  await page.getByRole('button', { name: /new account/i }).click();
  await page.getByRole('button', { name: 'Credit card' }).click();
  await page.getByLabel('Account name').fill(accountName);
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('Account created')).toBeVisible();

  const account = page.locator('article').filter({ hasText: accountName });
  await expect(account).toBeVisible();
  await account.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit account' })).toBeVisible();
  await page.getByLabel('Credit limit (optional)').fill('1800');
  await page.getByRole('button', { name: 'Update account' }).click();

  await expect(page.getByText('Account updated')).toBeVisible();
  await expect(account).toContainText('Limit $1,800.00');
});
test('owner can manage core ledger workflows', async ({ page }, testInfo) => {
  const accountName = `${testInfo.project.name} E2E Cash`;
  const expenseName = `${testInfo.project.name} E2E groceries`;
  const incomeName = `${testInfo.project.name} E2E income`;
  const transferName = `${testInfo.project.name} E2E transfer`;
  await page.goto('/login');
  await page.getByRole('button', { name: /emulator owner/i }).click();
  await expect(page.getByRole('link', { name: 'Accounts' }).last()).toBeVisible();
  await page.goto('/accounts');
  await page.getByRole('button', { name: /new account/i }).click();
  await page.getByLabel('Account name').fill(accountName);
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(
    page.getByRole('region', { name: 'Accounts' }).getByText(accountName, { exact: true }),
  ).toBeVisible();
  await page.goto('/transactions/new');
  await enterAmount(page, '10.00');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  for (const key of ['2', 'Decimal point', '5', '0']) {
    await page.getByRole('button', { name: key, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Equals' }).click();
  await expect(page.getByRole('textbox', { name: 'Calculate amount' })).toHaveValue('12.5');
  await page.getByLabel('Description').fill(expenseName);
  await page.getByRole('button', { name: 'Account: Cash' }).click();
  await page.getByRole('button', { name: /Groceries/ }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText(expenseName)).toBeVisible();

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Income' }).click();
  await enterAmount(page, '100.00');
  await page.getByLabel('Description').fill(incomeName);
  await page.getByRole('button', { name: 'Account: Cash' }).click();
  await page.getByRole('button', { name: /Salary/ }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText(incomeName)).toBeVisible();

  await page.goto('/transactions/new');
  await page.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Move money' })).toBeVisible();
  await enterAmount(page, '5.00');
  await page.getByLabel('Description').fill(transferName);
  await page.getByRole('button', { name: 'From account: Cash' }).click();
  await page.getByRole('button', { name: 'To account: Savings' }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText(transferName).first()).toBeVisible();

  const expenseRow = page.getByRole('row').filter({ hasText: expenseName });
  await expenseRow.getByRole('link', { name: 'Edit' }).click();
  const editedExpenseName = `${expenseName} edited`;
  await page.getByLabel('Description').fill(editedExpenseName);
  await page.getByRole('button', { name: 'Update entry' }).click();
  const editedRow = page.getByRole('row').filter({ hasText: editedExpenseName });
  await editedRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(editedExpenseName)).not.toBeVisible();

  await page.goto('/budgets');
  await page.getByRole('button', { name: /new budget/i }).click();
  await page.getByLabel('Expense category').selectOption({ label: 'Housing' });
  await page.getByLabel('Monthly limit').fill('400.00');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(page.locator('p').filter({ hasText: /^Housing$/ })).toBeVisible();

  await page.goto('/settings/backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/personal-ledger.*backup\.json/);
});

test('owner can customize categories, cards, and the black theme', async ({ page }, testInfo) => {
  const parentName = `${testInfo.project.name} Leisure`;
  const childName = `${testInfo.project.name} Games`;
  const renamedChild = `${childName} & apps`;

  await page.goto('/login');
  await page.getByRole('button', { name: /emulator owner/i }).click();
  await expect(page.getByRole('link', { name: 'Accounts' }).last()).toBeVisible();

  await page.goto('/categories');
  await page.getByRole('button', { name: /new category/i }).click();
  await page.getByLabel('Category name').fill(parentName);
  await page.getByRole('button', { name: 'Entertainment' }).click();
  await page.getByRole('button', { name: 'Create category' }).click();
  const hierarchy = page.getByLabel('Expense category hierarchy');
  await expect(hierarchy.getByText(parentName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Edit ${parentName}` }).click();
  await expect(page.getByRole('button', { name: 'Entertainment' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Close category editor' }).click();

  await page.getByRole('button', { name: `Add subcategory to ${parentName}` }).click();
  await page.getByLabel('Category name').fill(childName);
  await page.getByRole('button', { name: 'Create category' }).click();
  await expect(hierarchy.getByText(childName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Edit ${childName}` }).click();
  await page.getByLabel('Category name').fill(renamedChild);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(hierarchy.getByText(renamedChild, { exact: true })).toBeVisible();

  await page.goto('/accounts');
  const creditCard = page.locator('article').filter({ hasText: 'Everyday card' });
  await expect(creditCard.getByText('Amount owed')).toBeVisible();
  await expect(creditCard.getByText('Available')).toBeVisible();
  await expect(creditCard).toContainText('Limit $2,500.00');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect
    .poll(() =>
      page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe('rgb(5, 6, 5)');
  await page.getByRole('button', { name: 'System', exact: true }).click();
});
