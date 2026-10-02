# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For the generic app structure this repo follows (folder layout, routing
pattern, i18n approach, naming conventions, testing split) see
[`maat-core/STRUCTURE.md`](https://github.com/maat-apps/maat-core/blob/main/STRUCTURE.md).
For the "verify each change exactly once" principle behind this repo's
automation setup, see
[`maat-core/VERIFICATION.md`](https://github.com/maat-apps/maat-core/blob/main/VERIFICATION.md).
What follows here is what's specific to **albums** — product intent and
scope are in [`PRODUCT.md`](./PRODUCT.md).

<!-- BEGIN AUTO-GENERATED: setup-claude-workflow -->
<!-- Only Project Snapshot and Commands below are ever rewritten by --refresh. -->

## Project Snapshot

- Vite + React + TypeScript, Tailwind v4, shadcn (`base-nova`).
- Mobile-only (`@maat-apps/ui`'s `MobileGate`, from `src/app/root.tsx`), like routines.

## Commands

| Purpose   | Command                 |
| --------- | ----------------------- |
| Dev       | `npm run dev`           |
| Build     | `npm run build`         |
| Lint      | `npm run lint:fix`      |
| Format    | `npm run format`        |
| Typecheck | `npm run typecheck`     |
| Unit test | `npm run test:coverage` |
| E2E test  | `npm run test:e2e`      |
| Validate  | `npm run validate`      |

<!-- Everything below is seeded once, then append-only — --refresh never rewrites it. -->

## Conventions

- Filenames: kebab-case everywhere, including components; component names
  inside a file stay PascalCase.
- Named exports throughout.
- Hooks (`use*`) live in `src/hooks/`, not `src/lib/` — `lib/` stays free
  of `react`/`react-dom` imports.
- A Playwright project's reusable test-helper file belongs at
  `e2e/utils.ts`, not `fixtures.ts` — these are plain functions specs call
  directly, not Playwright's own `test.extend()` fixture-injection system.
- **Storage.** `src/lib/storage.ts` is the in-memory + IndexedDB
  write-through store for albums (maat-core's `docs/storage.md`), read
  through `src/hooks/use-albums.ts`; albums are validated per entry
  (`schemas.ts`). Filtering, sorting and duplicate detection are pure
  helpers in `album-utils.ts`. Backups and the pre-update snapshot share
  one format (`backup.ts`, `app-update.ts`).
- **Screens.** `src/app/router.tsx`: `/` (`views/home`: the collection —
  status filter chips with counts, sort key + direction, grid/list, all
  remembered in `app-settings.ts`'s `collection` prefs; settings drawer),
  `/new` and `/:id/edit` (`views/album/album-form-view.tsx`, validated by
  `lib/album-form.ts`), `/:id` (`album-view.tsx`: cover, one-tap status,
  Spotify link). Covers render through `components/album-cover.tsx`
  (placeholder on a missing or broken URL) via `hooks/use-cover-src.ts`:
  once in view, `lib/cover-store.ts` serves the IndexedDB copy or fetches
  (CORS) and stores it — per album id, encrypted with the lock's key,
  tracked in an index key since the store can't list keys; on failure the
  `<img>` uses the URL directly. Covers are a cache: not in backups,
  cleared by the lock's rewrite/erase and a backup restore, deleted with
  their album. Back uses
  `useSmartBack`.
- **i18n.** `src/i18n/en.json` and `pl.json` (core's `createTranslation`;
  device language on first launch, Settings → Language after). `t()`
  only accepts keys present in both — keep them in sync.
- **E2E.** Settings persist in the background: before a reload that should
  keep a pref, wait with `e2e/utils.ts`'s `waitForStoredPrefs`. A spec
  that `page.route`s a cover blocks service workers (`covers.spec.ts`) —
  the worker's own fetches bypass the route.
- **CSV import.** `csv.ts` parses RFC 4180 CSV; `csv-import.ts` maps a
  `Rok`/`Artysta`/`Tytuł`/`WRACAM?` (or English) header to albums and
  skips duplicates. **Never commit the owner's own list** — tests and e2e
  use made-up rows only.
- **App lock.** Every maat-apps app has it (`@maat-apps/core/lock` +
  `@maat-apps/ui/app-lock-gate`, wrapped around the router in
  `src/app/router.tsx`). `src/lib/app-lock.ts` rewrites the albums with
  the current key and erases them plus the update snapshot; `storage.ts`
  and `app-update.ts` encrypt with `src/lib/encryption-key.ts`. **Never
  change `HKDF_INFO` (`"albums-data-v1"`)** — existing encrypted data
  would become unreadable.
- Full pattern log: none yet — run `/learn-patterns` after a non-trivial
  session to start one.

## Workflow Rules

- Don't manually re-run lint/format/typecheck/build/test to double-check a
  change before committing — CI runs the full `npm run validate` gate on
  every PR; see `maat-core/VERIFICATION.md` for why running it twice is
  pure waste, not extra safety.
- Check the current branch before editing or committing anything — never
  edit or commit directly on `main`.
- Name branches `<type>/<short-descriptive-slug>` — see
  `maat-core/STRUCTURE.md`'s "Branch naming" section — not a generic or
  session-scoped name; cut a fresh branch per PR/task rather than reusing
  one across unrelated changes.
- Commit once a task's changes are complete, then use `/open-pr` to push
  and open the PR.

<!-- END AUTO-GENERATED: setup-claude-workflow -->
