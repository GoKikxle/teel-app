import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './hooks/useAuth.tsx';
import { ToastProvider } from './hooks/useToast.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);

// The service worker's fetch handler is cache-first for everything but
// navigations, including the dev server's own bundled JS/CSS module
// URLs. Registering it under `vite dev` means a plain page reload can
// get served a stale cached copy of /src/index.css (or any other
// module) instead of the live file, since a normal reload doesn't
// bypass an active service worker the way it bypasses the HTTP cache.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // A tab left open across a deploy runs its original JS in memory
    // indefinitely (nothing forces an SPA to re-fetch anything) while
    // sw.js's own skipWaiting()/clients.claim() let a newer worker take
    // over that same tab's future requests as soon as it's noticed —
    // mismatched old-JS-new-worker was one plausible contributor to the
    // "page just stops working, needs a hard refresh" reports. Reloading
    // once when a new worker takes control gets that tab back onto the
    // matching bundle automatically, closing the gap between "a deploy
    // happened" and "the open tab actually has it." Guarded so a second
    // controllerchange (e.g. yet another deploy before the reload even
    // finishes) can't chain into a reload loop.
    let reloadedForNewWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedForNewWorker) return;
      reloadedForNewWorker = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    // Dev mode: don't just skip registering a new one — actively tear
    // down any service worker + cache left over from a visit before this
    // guard existed. Without this, a browser that registered the worker
    // on an earlier dev visit keeps serving stale cached bundles on every
    // reload indefinitely; gating future registrations alone never
    // cleans up what's already there.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }
  }
}
