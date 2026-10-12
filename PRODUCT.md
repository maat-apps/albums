# Albums

## Product

Albums is a private, phone-first PWA for keeping track of which albums
you've listened to — and, for each one, whether you want to come back to
it. No accounts, no server: the collection lives in the browser's
IndexedDB, encrypted when the app lock is on.

## Platform

web - PWA, mobile-only (like routines, trainer and notes).

## An album

| Field  | Notes                                                                |
| ------ | -------------------------------------------------------------------- |
| Year   | Release year.                                                        |
| Artist | Artist or band.                                                      |
| Title  | Album title.                                                         |
| Status | `to listen`, `listened — coming back`, `listened — not coming back`. |
| Cover  | Optional URL of the cover image from a public source.                |
| Deezer | Optional link to the album on Deezer.                                |

## Behavior

- **Two view modes**, switchable and remembered: a two-column grid of
  covers, or a list with a cover thumbnail, artist, title and year.
- **Filter** by status: all, to listen, coming back, not coming back.
- **Sort** by year, title or artist, ascending or descending — available
  in both view modes.
- **Add / edit / delete** an album; changing its status is one tap from
  the album view.
- **Open in Deezer** from the album view, straight to the album — shown
  only when the album has a Deezer link (found by the app, or pasted in
  the album's form). Links are the user's data: they're part of backups.
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
- Values are trimmed. A row matching an existing album keeps that album
  (and its cover) and only updates its status when the file's status
  differs; an empty status never overrides one. Matching ignores case,
  accents, punctuation, `&` vs `and` and a leading "The"; the year must
  match unless one side has none. Re-importing is safe.

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
- Covers found by the app are asked for at 1200px, sharp across a phone's
  full width; covers saved earlier at a smaller size are upgraded the same
  way (the old copy shows until the sharper one has loaded).
- **Finding covers and links** (Settings → Data → Find covers): every
  album without a cover, a year or a Deezer link is searched on
  MusicBrainz, and a cover still missing after that on iTunes (Apple's
  free search, no key; about 20 requests a minute). Only the artist and
  title leave the device, and no account is needed. The first result with
  the album's artist and title (editions like "Deluxe" or "Remastered"
  ignored) is taken without asking — preferring the album's year, then a
  plain release, then an album over a single — and fills what the album
  lacks: cover, year, and the Deezer link MusicBrainz has for it, if any
  (well covered for international releases, less for Polish ones).
  Deezer's own API can't be used: it doesn't allow reading from a web
  page, and neither does Odesli (song.link). Only albums without a cover
  and with no result of that artist and title are listed to review, where
  the user picks a match or "None of these". A service that can't be
  reached is left out for the rest of the run. It keeps going after
  leaving the covers screen, and stopping keeps what was found. An album
  without a cover also offers "Find a cover" from its own view.
- **Opening an album** looks it up by itself, the same way, when it's
  missing a cover, a Deezer link or a year and hasn't been tried yet: the
  cover and the "Open in Deezer" link appear without a tap.
