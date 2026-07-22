import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPage } from '@/features/accounts/AccountsPage';

const mocks = vi.hoisted(() => ({
  archiveAccount: vi.fn(),
  saveAccount: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/authentication/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'owner' } }),
}));

vi.mock('@/app/DataProvider', () => ({
  useData: () => ({
    accounts: [
      {
        id: 'savings',
        name: 'Rainy day',
        type: 'savings',
        currency: 'USD',
        openingBalanceMinor: 25_000,
        currentBalanceMinor: 27_500,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }),
}));

vi.mock('@/services/repositories', () => ({
  archiveAccount: mocks.archiveAccount,
  saveAccount: mocks.saveAccount,
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe('accounts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('offers account-type tiles during creation and locks the type during editing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /new account/i }));
    expect(screen.getByRole('button', { name: 'Credit card' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText(/account type is locked after creation/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Credit card' })).not.toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
  });

  it('confirms archival and exposes pending and success states', async () => {
    let resolveArchive!: () => void;
    mocks.archiveAccount.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveArchive = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Archive “Rainy day”?');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mocks.archiveAccount).toHaveBeenCalledWith('owner', 'savings', true);
    expect(screen.getByRole('button', { name: /archiving/i })).toBeDisabled();

    resolveArchive();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Account archived'));
  });
});
