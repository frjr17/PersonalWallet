import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff } from 'lucide-react';
import { Toaster } from 'sonner';
import { router } from './router';
import { ErrorBoundary } from './ErrorBoundary';
import { useAuth } from '@/features/authentication/AuthProvider';
import { loadSettings } from '@/services/repositories';
import { setThemePreference, startThemeSync, type ResolvedTheme } from '@/lib/theme';
export function App() {
  const { user } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => startThemeSync(setTheme), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void loadSettings(user.uid)
      .then((settings) => {
        if (active && settings) setThemePreference(settings.theme);
      })
      .catch(() => {
        // Keep the locally mirrored preference when settings cannot sync.
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <ErrorBoundary>
      {!online && (
        <div className="fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          <WifiOff size={15} />
          Working offline
        </div>
      )}
      {needRefresh && (
        <button
          className="fixed bottom-20 right-4 z-[70] rounded-xl bg-jade px-4 py-3 font-bold text-white shadow-lg"
          onClick={() => void updateServiceWorker(true)}
        >
          Update available · reload
        </button>
      )}
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" theme={theme} />
    </ErrorBoundary>
  );
}
