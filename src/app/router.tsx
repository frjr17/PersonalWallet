import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/features/authentication/AuthProvider';
import { LoginPage } from '@/features/authentication/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { AccountDetailPage } from '@/features/accounts/AccountDetailPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { TransactionFormPage } from '@/features/transactions/TransactionFormPage';
import { BudgetsPage } from '@/features/budgets/BudgetsPage';
import { RecurringPage } from '@/features/recurring/RecurringPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ImportsPage } from '@/features/imports/ImportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { BackupPage } from '@/features/backups/BackupPage';
function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-display animate-pulse">Opening your ledger…</p>
      </main>
    );
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <Protected />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/accounts', element: <AccountsPage /> },
      { path: '/accounts/:accountId', element: <AccountDetailPage /> },
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/transactions', element: <TransactionsPage /> },
      { path: '/transactions/new', element: <TransactionFormPage /> },
      { path: '/transactions/:transactionId/edit', element: <TransactionFormPage /> },
      { path: '/budgets', element: <BudgetsPage /> },
      { path: '/recurring', element: <RecurringPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/imports', element: <ImportsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/backup', element: <BackupPage /> },
    ],
  },
]);
