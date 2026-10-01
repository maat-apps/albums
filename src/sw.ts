/// <reference lib="webworker" />

// Entry for the built service worker. vite-plugin-pwa's injectManifest
// compiles this file and substitutes `self.__WB_MANIFEST` with the
// content-hashed build assets; the worker itself (precache, network-first
// navigations, cache-first assets, gated skip-waiting) is
// @maat-apps/core/sw's registerAppWorker.

import { registerAppWorker } from "@maat-apps/core/sw";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

registerAppWorker(self, {
  // Bump whenever the app shell changes — activation deletes every other cache.
  cacheName: "albums-v1",
  manifest: self.__WB_MANIFEST,
  // Not hardcoded: a PR preview under "/albums/pr-<n>/" caches its own shell.
  baseUrl: import.meta.env.BASE_URL,
});
