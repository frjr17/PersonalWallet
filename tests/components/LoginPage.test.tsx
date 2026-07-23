import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
const signInAsEmulatorOwner = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/firebase', () => ({ usingEmulators: true }));
vi.mock('@/features/authentication/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle,
    signInAsEmulatorOwner,
    signOutUser: vi.fn(),
  }),
}));

import { LoginPage } from '@/features/authentication/LoginPage';

describe('LoginPage', () => {
  it('offers only Google sign-in plus the local emulator shortcut', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pocket Ledger' })).toBeInTheDocument();
    const google = screen.getByRole('button', { name: /continue with google/i });
    expect(google).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emulator owner/i })).toBeInTheDocument();
    // no registration workflow of any kind
    expect(screen.queryByText(/sign up|register|create account/i)).not.toBeInTheDocument();

    await userEvent.click(google);
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });
});
