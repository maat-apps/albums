# Albums

## Product

Albums is a private, phone-first PWA for keeping track of which albums
you've listened to — and, for each one, whether you want to come back to
it. No accounts, no server: the collection lives in the browser's
IndexedDB, encrypted when the app lock is on.

## Platform

web - PWA, mobile-only (like routines, trainer and notes).

## An album

| Field   | Notes                                                                |
| ------- | -------------------------------------------------------------------- |
| Year    | Release year.                                                        |
| Artist  | Artist or band.                                                      |
| Title   | Album title.                                                         |
| Status  | `to listen`, `listened — coming back`, `listened — not coming back`. |
| Cover   | Optional URL of the cover image from a public source.                |
| Spotify | Optional URL; the album view opens it in Spotify.                    |

## Behavior

- **Two view modes**, switchable and remembered: a two-column grid of
  covers, or a list with a cover thumbnail, artist, title and year.
- **Filter** by status: all, to listen, coming back, not coming back.
- **Sort** by year, title or artist, ascending or descending — available
  in both view modes.
- **Add / edit / delete** an album; changing its status is one tap from
  the album view.
- **Settings** (a drawer): language (English/Polish), app lock, backup
  export/import, install and update.

## Importing an existing list (CSV)

An existing list kept in a spreadsheet is imported in the app from a CSV
file (e.g. Google Sheets → File → Download → CSV). The file stays on the
device: nothing talks to Google, and no personal list is ever committed
to this repository.

- Expected header: `Rok`, `Artysta`, `Tytuł`, `WRACAM?` (year, artist,
  title, status), in any column order.
- `WRACAM?`: `GREEN` → coming back, `RED` → not coming back, empty → to
  listen.
- Values are trimmed; a row matching an existing album (same artist,
  title and year) is skipped, so re-importing is safe.

## Covers

Covers are the one place the app talks to another server, and only for
the image itself — the user decides by adding a URL.

- **Recommended source: [Cover Art Archive](https://coverartarchive.org)**
  (MusicBrainz) — free, no API key, stable URLs, and it allows the app to
  fetch the image. Discogs needs an API token for its image URLs and
  restricts hotlinking, so it's a poor fit.
- An image is fetched once and kept locally (IndexedDB, encrypted with the
  rest), so covers keep working offline and survive cache clears and app
  updates. Where a server doesn't allow that, the cover is shown straight
  from its URL instead. Stored covers are a cache: never in a backup, and
  dropped (to load again) when the lock changes or a backup is restored.
- Looking covers up automatically (searching MusicBrainz by artist and
  title) is a candidate follow-up, not part of the first version.

## Out of scope, on purpose

Ratings, reviews, genres, tracklists, play counts, streaming playback in
the app, sharing and sync.

## Design direction

The ecosystem's shared theme (`@maat-apps/ui/theme.css`): true black and
white on Outfit — the covers provide all the color.
