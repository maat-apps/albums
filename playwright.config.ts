import { defineConfig, devices } from "@playwright/test";

// Runs against the static production build (npm run build), served by
// `vite preview` under the app's real base path (/albums/) — the same
// GitHub Pages layout the app assumes at runtime, unlike the dev server.
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173/albums/",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Galaxy A55"] },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
