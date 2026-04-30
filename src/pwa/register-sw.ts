// Service worker registration. Idempotent — calling twice is safe.

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          // A new SW is waiting. Activate immediately on next visit.
          installing.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  } catch (e) {
    console.warn('SW registration failed:', e);
  }
}
