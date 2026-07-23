import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usingEmulators } from '@/lib/firebase';
import { userMessage, logError } from '@/lib/errors';
import { useAuth } from '@/features/authentication/AuthProvider';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { user, signInWithGoogle, signInAsEmulatorOwner } = useAuth();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      logError('login', error);
      toast.error(userMessage(error, 'Sign-in did not complete. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-4 size-14" />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Pocket Ledger</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your private ledger. One account, no sign-ups.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => run(signInWithGoogle)}
          >
            <GoogleMark />
            Continue with Google
          </Button>
          {usingEmulators && (
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => run(signInAsEmulatorOwner)}
            >
              Emulator owner (local only)
            </Button>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Only the configured owner account can open this ledger.
        </p>
      </div>
    </main>
  );
}
