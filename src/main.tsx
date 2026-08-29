import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './hooks/useAuth.tsx';
import { ToastProvider } from './hooks/useToast.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>
);

// Dev-only guard: the service worker's fetch handler is cache-first for
// everything but navigations, including the dev server's own bundled
// JS/CSS module URLs. Registering it under `vite dev` means a plain page
// reload can get served a stale cached copy of /src/index.css (or any
// other module) instead of the live file, since a normal reload doesn't
// bypass an active service worker the way it bypasses the HTTP cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
