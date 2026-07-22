import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TransactionFormPage } from '@/features/transactions/TransactionFormPage';

vi.mock('@/features/authentication/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'owner' } }),
}));
vi.mock('@/app/DataProvider', () => ({
  useData: () => ({
    accounts: [
      {
        id: 'cash',
        name: 'Cash',
        type: 'cash',
        currency: 'USD',
        openingBalanceMinor: 0,
        currentBalanceMinor: 0,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    categories: [
      {
        id: 'food',
        name: 'Food',
        type: 'expense',
        icon: 'general',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    transactions: [],
  }),
}));
vi.mock('@/services/repositories', () => ({
  createTransaction: vi.fn(),
  createTransfer: vi.fn(),
  updateSimpleTransaction: vi.fn(),
}));

describe('transaction entry form', () => {
  it('uses direct choices and disables transfer with only one account', () => {
    render(
      <MemoryRouter>
        <TransactionFormPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled();
    expect(screen.getByText(/add a second active account/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByRole('region', { name: /amount calculator/i })).toBeInTheDocument();
  });

  it('does not turn a missing edit URL into a new transaction', () => {
    render(
      <MemoryRouter initialEntries={['/transactions/missing/edit']}>
        <Routes>
          <Route path="/transactions/:transactionId/edit" element={<TransactionFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /transaction unavailable/i })).toBeInTheDocument();
    expect(screen.getByText(/transaction not found/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save entry/i })).not.toBeInTheDocument();
  });
});
