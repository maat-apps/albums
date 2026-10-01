// Extends the shared base from maat-core/configs/eslint/base.mjs (copied
// into this repo below, alongside .prettierrc.json and tsconfig.base.json —
// see maat-apps/maat-core's configs/README.md for why these are copied
// rather than installed as a package for now). Add repo-specific overrides
// after baseConfig, not by editing configs/eslint/base.mjs in place.
import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "./configs/eslint/base.mjs";

export default defineConfig([
  ...baseConfig,
  // Claude Code worktrees each carry their own tsconfig, which makes
  // typescript-eslint fail every file with "multiple candidate TSConfigRootDirs".
  globalIgnores([".claude/worktrees/**"]),
]);
