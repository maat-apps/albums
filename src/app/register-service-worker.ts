// Called once at app boot (see both src/main.tsx and
// src/main.mobile-gate.tsx) rather than from a React effect — this is a
// one-time app-wide startup action, not tied to any component's lifecycle.
export function registerServiceWorker(): void {
  // sw.js is only built in production (see vite.config.ts); registering it
  // in dev would also fight Vite's own HMR with a caching service worker.
  // BASE_URL (not a hardcoded "/albums/") so a PR preview built under
  // "/albums/pr-<n>/" registers its own worker scoped to that subpath
  // instead of colliding with main's.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined);
  }
  // Best-effort request that the browser not evict IndexedDB under storage
  // pressure — cheap insurance once this app keeps data there.
  if ("storage" in navigator && "persist" in navigator.storage) {
    navigator.storage.persist().catch(() => undefined);
  }
}
