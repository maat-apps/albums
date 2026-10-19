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
- **Storage.** The GitHub repository pattern (maat-core's
  `docs/storage-github.md`) on top of the local one (`docs/storage.md`):
  `src/lib/storage.ts` is `@maat-apps/core/local`'s `createLocalStore`
  (`albumsStore`) plus the album mutations, read through
  `src/hooks/use-albums.ts`; albums are validated per entry
  (`schemas.ts`). Filtering, sorting and duplicate detection are pure
  helpers in `album-utils.ts`. Backups and the pre-update snapshot share
  one format (core's `createLocalBackup`: `backup.ts`, `app-update.ts`);
  a Settings import merges (`mergeBackup` → `storage.ts`'s
  `mergeIntoAlbums`: `album-merge.ts`'s `mergeAlbums` with nothing
  synced, so nothing is deleted), only the snapshot restore replaces;
  `app-lock.ts` wires store, snapshot, covers and the GitHub connection
  through `lockData`.
- **Screens.** `src/app/router.tsx`: `/` (`views/home`: the collection,
  a header pinned to the top — the title and the settings gear; the
  collection's controls in `@maat-apps/ui`'s `BottomBar` — sort key +
  direction, grid/list, search and add in its main row, status filter chips with
  counts above (`collection-controls.tsx`), all remembered in
  `app-settings.ts`'s `collection` prefs — but each launch opens on the
  "all" filter; on a collection 4+ screens tall,
  `fast-scroller.tsx` — a rail at the right edge, below the header, shown while scrolling (`hooks/use-scroll-activity.ts`) that
  jumps by `album-utils.ts`'s `groupAlbums`, the sort's groups — to each
  group's first `data-album-index` row; sorting uses `Intl.Collator("pl")`
  so groups stay contiguous),
  `/search` (`views/search/search-view.tsx`: the collection filtered by
  `album-utils.ts`'s `searchAlbums`, as a list; the field pinned in a
  `BottomBar`, the query in `?q=` so Back from an album keeps it),
  `/new` (`views/album/add-album-view.tsx`: a MusicBrainz text search —
  `musicbrainz.ts`'s `searchReleaseGroupsByText`, debounced for its rate
  limit; tapping a result saves `album-form.ts`'s `releaseGroupToAlbum`, or
  opens the album already matching it per `sameAlbum`), `/new/manual` (the
  by-hand fallback) and `/:id/edit` (`views/album/album-form-view.tsx`,
  validated by `lib/album-form.ts`), `/:id` (`album-view.tsx`, one screen with no scrolling, opened at the
  top — the cover
  shrinks to the largest square that fits: cover, one-tap status,
  "Open in …" for the streaming service chosen in Settings
  (`app-settings.ts`'s `streamingService`; `lib/streaming.ts`: Deezer,
  Spotify, Apple Music — `deezerUrl`/`spotifyUrl`/`appleMusicUrl`, read
  and normalised by `readLinks`), shown only with a link; opening
  it looks a missing cover/link/year up by itself via
  `hooks/use-album-lookup.ts` → the runner's `lookUpAlbumNow`, once per
  source verdict and without waiting out rate limits; the hook reports
  the search for the cover/link skeletons, and "Find a cover" shows only
  after it).
  Covers render through `components/album-cover.tsx` (placeholder on a missing or broken URL) via `hooks/use-cover-src.ts`:
  once in view, `lib/cover-store.ts` serves the IndexedDB copy or fetches
  (CORS) and stores it — per album id, encrypted with the lock's key,
  tracked in an index key since the store can't list keys; on failure the
  `<img>` uses the URL directly. Covers are a cache: not in backups,
  cleared by the lock's rewrite/erase and a backup restore, deleted with
  their album. Cover sizes: `lib/cover-url.ts` (1200px — Cover Art
  Archive and iTunes URLs name the size; stored smaller URLs are read as
  1200px by `schemas.ts`, and the old cached copy stands in until the new
  one loads). Finding covers and links: `lib/musicbrainz.ts` (search and
  Cover Art Archive URLs; fills missing years; `findLinks` reads a matched
  release group's releases' URL relationships for its streaming links,
  then `linksLookup: "done"`. Deezer's own API and Odesli send no CORS
  headers and Spotify's needs a sign-in, so the browser can't use them),
  `lib/cover-lookup.ts` (pure matching: `pickMatch` — the artist may be
  a typo or two off, `editDistance` — `applyMatch`, what
  each source can still add — `isMissing` — and the album's `lookup`
  verdict — review/none/skipped), `lib/itunes.ts` (iTunes Search, the last
  fallback; its results carry Apple Music links, so it's also asked for
  one when that's the chosen service; `itunesLookup` verdict),
  `lib/cover-lookup-runner.ts` (bulk run, asks `sources` in order for what
  each album still misses — ~1 req/s on MusicBrainz, plus one for the
  links after a match, ~20/min on iTunes — leaves out a source that fails
  for the rest of the run, saves each album as it goes;
  `lib/cover-lookup-job.ts` runs it app-wide, so leaving `/covers` doesn't
  stop it) and `views/covers/` (`/covers`, `/covers/:id`; review lists
  hold albums without a cover). Streaming links are user data (in
  backups), unlike covers. E2E mocks MusicBrainz (search and releases),
  the archive and iTunes with `page.route` (service workers blocked). Back uses `useSmartBack`.
- **GitHub sync** (PRODUCT.md), on `@maat-apps/core/github`'s two-way
  mode — the client (REST contents API, fine-grained token, >1 MB from the
  blob), the connection and the sync loop live in core. Albums' own:
  `lib/albums-file.ts` (the file format over core's `formatJsonFile` —
  must stay byte-for-byte what the data repo's `scripts/albums.mjs`
  writes), `lib/album-merge.ts` (`albumMerge` for core's `mergeById`:
  newer `updatedAt` wins but fills empty cover/links/year, keeps this
  device's lookup verdicts, `sameAlbum` pairs before the first sync),
  `lib/github-sync.ts` (the connection under `GITHUB_KEY`, **only ever
  stored encrypted** — core refuses without an encrypting lock; the
  lock's rewrite re-encrypts or deletes it, erase deletes it; `sync`
  retries once on a 409; `startAutoSync`, from `app/router.tsx`, syncs on
  launch, after connecting, on returning to the app and a few seconds
  after a change — edits made during a sync go on top of its write-back,
  `album-merge.ts`'s `rebaseAlbums`; status and the last failure through
  `hooks/use-github.ts`'s `useGitHubSyncStatus`) and
  `views/settings/settings-github-section.tsx` (core's `GitHubError`
  kinds → messages).
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
  and `app-update.ts` encrypt with `src/lib/encryption-key.ts`. The lock comes back after
  time in the background per `app-settings.ts`'s `relockAfter` (Settings →
  Security; `relockAfterMs` feeds `createAppLock`). **Never
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
