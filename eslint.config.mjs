// Extends the shared base from @maat-apps/config. Add repo-specific
// overrides after baseConfig.
import { baseConfig } from "@maat-apps/config/eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  // Claude Code worktrees each carry their own tsconfig, which makes
  // typescript-eslint fail every file with "multiple candidate TSConfigRootDirs".
  globalIgnores([".claude/worktrees/**"]),
]);
