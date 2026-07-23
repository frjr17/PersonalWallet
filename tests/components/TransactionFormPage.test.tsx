import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { defaultSettings, type Account, type Category } from '@/types/domain';

const accounts: Account[] = [
  {
    id: 'checking',
    name: 'Checking',
    type: 'checking',
    currency: 'USD',
    openingBalanceMinor: 0,
    currentBalanceMinor: 10000,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'savings',
    name: 'Savings',
    type: 'savings',
    currency: 'USD',
    openingBalanceMinor: 0,
    currentBalanceMinor: 50000,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const categories: Category[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'expense',
    icon: 'groceries',
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const createEntry = vi.fn().mockResolvedValue('new-id');
const createTransfer = vi.fn().mockResolvedValue('transfer-id');

vi.mock('@/lib/firebase', () => ({ usingEmulators: false }));
vi.mock('@/app/DataProvider', () => ({
  useLedger: () => ({
    uid: 'owner',
    accounts,
    activeAccounts: accounts,
    categories,
    monthTransactions: [],
    monthBudgets: [],
    recurring: [],
    month: '2026-07',
    setMonth: vi.fn(),
    loading: false,
  }),
  useSettings: () => ({ settings: defaultSettings, updateSettings: vi.fn() }),
  useSettingsOptional: () => defaultSettings,
}));
vi.mock('@/services/finance', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    createEntry: (...args: unknown[]) => createEntry(...args),
    createTransfer: (...args: unknown[]) => createTransfer(...args),
  };
});

import { TransactionFormPage } from '@/features/transactions/TransactionFormPage';

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/transactions/new']}>
      <Routes>
        <Route path="/transactions/new" element={<TransactionFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TransactionFormPage', () => {
  beforeEach(() => {
    createEntry.mockClear();
    createTransfer.mockClear();
  });

  it('adapts fields to the selected type', async () => {
    renderForm();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record expense' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Income' }));
    expect(screen.getByRole('button', { name: 'Record income' })).toBeInTheDocument();
    expect(screen.getByLabelText('Payer (optional)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Transfer' }));
    expect(screen.getByLabelText('From account')).toBeInTheDocument();
    expect(screen.getByLabelText('To account')).toBeInTheDocument();
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
  });

  it('rejects a zero amount with a clear message', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Amount'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Record expense' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/greater than zero/i);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('parses the amount into minor units and records the expense', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.type(screen.getByLabelText(/^Description/), 'Weekly groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Record expense' }));
    await waitFor(() => expect(createEntry).toHaveBeenCalledOnce());
    const [, input] = createEntry.mock.calls[0]!;
    expect(input).toMatchObject({
      type: 'expense',
      accountId: 'checking',
      amountMinor: 1250,
      currency: 'USD',
      description: 'Weekly groceries',
    });
  });
});
