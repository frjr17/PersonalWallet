import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/features/authentication/AuthProvider';
import { DataProvider } from '@/app/DataProvider';
import { App } from '@/app/App';
import '@/index.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
);
