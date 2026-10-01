import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves no server-side rewrites, so a hard refresh or deep
// link to a client-routed path 404s unless something static exists there.
// Pages falls back to /404.html for any unresolved path, so shipping a copy
// of the SPA shell under that name lets React Router pick up the real route
// once the app boots. Drop this (and the base-path handling below) if this
// app doesn't deploy to GitHub Pages.
function spaFallback(): Plugin {
  return {
    name: "spa-fallback-404",
    apply: "build",
    closeBundle() {
      const outDir = resolve(import.meta.dirname, "dist");
      writeFileSync(
        resolve(outDir, "404.html"),
        readFileSync(resolve(outDir, "index.html")),
      );
    },
  };
}

// DEPLOY_BASE_PATH lets a PR-preview override the base path without
// touching this file — see routines' vite.config.ts for the fuller pattern.
// The default assumes a GitHub Pages deploy under this repo's own path
// (https://<org>.github.io/albums/); change it if this app deploys
// somewhere else.
const base = process.env.DEPLOY_BASE_PATH ?? "/albums/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // The app registers the worker itself — see
      // src/app/register-service-worker.ts.
      injectRegister: false,
      // The manifest is a hand-written static file (public/manifest.json),
      // linked manually from index.html.
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      // sw.js only exists after `vite build`; register-service-worker.ts
      // only registers it in production builds, so no dev-mode worker is
      // needed here.
      devOptions: {
        enabled: false,
      },
    }),
    spaFallback(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
});
