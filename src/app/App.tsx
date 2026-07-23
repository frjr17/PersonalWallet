import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { router } from '@/app/router';
import { Toaster } from '@/components/ui/sonner';

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version is ready', {
      id: 'sw-update',
      duration: Infinity,
      action: { label: 'Update', onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
      <UpdatePrompt />
    </>
  );
}
