import { ThemeProvider } from '@/lib/theme';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { AuthProvider } from '@/features/authentication/AuthProvider';

/** App-wide providers. Data providers mount under the protected route instead. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
