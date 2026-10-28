import { appVitestConfig } from "@maat-apps/config/vitest";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts so no build/PWA-style plugin
// ever runs during tests — see maat-core/STRUCTURE.md's Testing section.
export default defineConfig(appVitestConfig({ root: import.meta.dirname }));
