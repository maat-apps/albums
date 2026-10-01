#!/usr/bin/env bash
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Typecheck runs every time — it's cheap enough (a few seconds) to tolerate
# on every Stop regardless of what changed.
OUT=$(npm run typecheck --silent 2>&1)
ERR_COUNT=$(printf '%s' "$OUT" | grep -cE 'error TS')
if [ "$ERR_COUNT" -gt 0 ]; then
  echo "⚠ $ERR_COUNT TypeScript error(s) remain. Run /check for details."
fi

# The test suite is heavier (~10-15s), so it only runs when this turn
# actually touched src/ or tests/ — most turns (planning, docs, git
# operations, pure Q&A) don't, and shouldn't pay for a suite that has
# nothing new to check. Catches both modified-and-uncommitted and
# not-yet-added new files.
CHANGED=$(git diff --name-only HEAD -- src tests 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard -- src tests 2>/dev/null)
if [ -n "$CHANGED" ] || [ -n "$UNTRACKED" ]; then
  if ! npm run test:coverage --silent >/dev/null 2>&1; then
    echo "⚠ Unit tests or the coverage threshold are failing. Run /check for details."
  fi
fi

exit 0
