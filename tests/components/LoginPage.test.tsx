import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, vi } from 'vitest';
import { LoginPage } from '@/features/authentication/LoginPage';
vi.mock('@/features/authentication/AuthProvider', () => ({
  useAuth: () => ({ user: null, login: vi.fn(), emulatorLogin: vi.fn() }),
}));
vi.mock('@/lib/firebase', () => ({ env: { VITE_USE_FIREBASE_EMULATORS: 'false' } }));
it('renders the single production login action', () => {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  expect(screen.queryByText(/register/i)).not.toBeInTheDocument();
});
