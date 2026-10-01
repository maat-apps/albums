// Shared ESLint base for a Vite + React + TypeScript maat-apps repo.
// Copy this file into a new repo (there's no published package yet — see
// maat-apps/maat-core#18) and import it from that repo's own
// eslint.config.mjs, adding repo-specific overrides after it rather than
// editing this file in place. Extracted from routines' eslint.config.mjs,
// which stays the reference implementation — see maat-apps/maat-core#1.
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export const baseConfig = defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    // Node-run scripts: root config files and any Claude Code hook scripts.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
