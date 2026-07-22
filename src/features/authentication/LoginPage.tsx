import { Landmark, LockKeyhole, WifiOff } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from './AuthProvider';
import { env } from '@/lib/firebase';
export function LoginPage() {
  const { user, login, emulatorLogin } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
      <section className="flex flex-col justify-between bg-jade p-8 text-oat lg:p-16">
        <div className="flex items-center gap-3 font-display">
          <span className="grid size-10 place-items-center rounded-xl bg-oat text-jade">
            <Landmark />
          </span>{' '}
          Personal Ledger
        </div>
        <div className="max-w-xl py-20">
          <p className="mb-5 font-mono text-xs uppercase tracking-[.22em] text-oat/65">
            Your money, held close
          </p>
          <h1 className="font-display text-5xl leading-[1.04] sm:text-7xl">
            A quieter way to know where you stand.
          </h1>
          <p className="mt-7 max-w-md text-lg text-oat/75">
            One private ledger for accounts, spending plans, and the small decisions that shape a
            month.
          </p>
        </div>
        <p className="text-sm text-oat/60">
          No bank connections. No advertising. No shared profiles.
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Private access</p>
          <h2 className="mt-3 font-display text-3xl">Open your ledger</h2>
          <p className="mb-8 mt-3 text-ink/60">Only the configured owner account can continue.</p>
          <Button className="w-full" onClick={() => void login()}>
            <LockKeyhole size={18} />
            Continue with Google
          </Button>
          {env.VITE_USE_FIREBASE_EMULATORS === 'true' && (
            <Button
              className="mt-3 w-full"
              variant="secondary"
              onClick={() => void emulatorLogin()}
            >
              Continue as emulator owner
            </Button>
          )}
          <div className="mt-8 flex gap-3 rounded-2xl bg-mist/55 p-4 text-sm">
            <WifiOff className="shrink-0 text-jade" size={19} />
            <p>Offline storage is optional and should only be enabled on a trusted device.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
