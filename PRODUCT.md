# Albums

## Product

Albums is a private, phone-first PWA for keeping track of which albums
you've listened to — and, for each one, whether you want to come back to
it. No accounts, no server: the collection lives in the browser's
IndexedDB, encrypted when the app lock is on.

## Platform

web - PWA, mobile-only (like routines, notes and gym-charts).

## An album

| Field  | Notes                                                                |
| ------ | -------------------------------------------------------------------- |
| Year   | Release year.                                                        |
| Artist | Artist or band.                                                      |
| Title  | Album title.                                                         |
| Status | `to listen`, `listened — coming back`, `listened — not coming back`. |
| Cover  | Optional URL of the cover image from a public source.                |
| Links  | Optional links to the album on Deezer, Spotify and Apple Music.      |

## Behavior

- **Thumb-first:** on the collection, everything to tap — filters, sort,
  view mode, settings and add — sits in a bar at the bottom of the screen;
  the top is only the title.
- **Two view modes**, switchable and remembered: a two-column grid of
  covers, or a list with a cover thumbnail, artist, title and year.
- **Filter** by status: all, to listen, coming back, not coming back.
- **Sort** by year, title or artist, ascending or descending — available
  in both view modes. Text sorts by Polish rules (Ą after A, Ł after L).
- **Fast scroller:** on a long collection, a rail along the right side
  appears while scrolling; dragging its thumb jumps by the sort's groups —
  first letter (Polish letters on their own, digits and symbols under
  "#"), or year — naming the group
  in a bubble and buzzing at each change where the phone can.
- **Add** an album by searching MusicBrainz: one field, artist, title or
  both; tapping a result adds it — to listen — with its year and cover, and
  its streaming link is found when it opens. Results already in the
  collection are marked and open that album. An album MusicBrainz doesn't
  have can still be added by hand ("Not there? Add it by hand"). Only the
  typed text leaves the device.
- **Edit / delete** an album; changing its status is one tap from the
  album view.
- **Open in Deezer / Spotify / Apple Music** from the album view,
  straight to the album on the streaming service chosen in Settings —
  shown only when the album has a link there (found by the app, or pasted
  in the album's form, which shows that service's field). Links are the
  user's data: they're part of backups.
- **Settings** (a drawer): language (English/Polish), app lock, backup
  export/import (import merges into the collection on the device: the
  same album is matched as with a sync, the newer edit wins, and nothing
  is replaced or deleted), install and update, and the streaming service.

## Syncing with GitHub

Optional: the collection can be kept in a JSON file in the user's own
(private) GitHub repository, so it can be edited there, versioned, and
filled in by the repository's own workflows. Nothing is sent anywhere
until the user connects.

- **Only with the encrypting app lock.** Connecting needs a fine-grained
  access token that can write to that repository, and the token is only
  ever stored encrypted with the lock's key. Without a lock that encrypts
  (WebAuthn PRF) Settings explains this and offers no form; turning the
  lock off deletes the connection.
- **Settings → Sync with GitHub:** repository (`owner/name`), branch,
  file (default `albums.json`) and the token. Connecting checks the token
  can read the repository; the file may not exist yet.
- **Syncing is automatic** once connected: right after connecting, on
  launch, when the app comes back after a minute or more, and a few
  seconds after a change here; a failure shows in Settings, and the
  **Sync** button there runs it by hand. Each sync merges both sides and writes the
  result to both: albums new on either side are kept, one deleted on
  either side since the last sync is deleted on the other, and one edited
  on both keeps the newer edit — with a cover and links the other side
  filled in. On the first sync an album the file has under another id is
  matched as the same one (same rule as the CSV import). A file with an
  album the app can't read is left alone, and so is the phone.
- **The file:** an array of albums (id, year, artist, title, status,
  cover, links, created/updated), sorted by artist, year and title,
  two-space indented — so each sync's commit shows exactly what changed.
  This device's lookup verdicts aren't in it.

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

Besides an optional GitHub sync, covers are the one place the app talks
to another server, and only for the image itself — the user decides by
adding a URL.

- **Recommended source: [Cover Art Archive](https://coverartarchive.org)**
  (MusicBrainz) — free, no API key, stable URLs, and it allows the app to
  fetch the image. Discogs needs an API token for its image URLs and
  restricts hotlinking, so it's a poor fit.
- An image is fetched once and kept locally (IndexedDB, encrypted with the
  rest), so covers keep working offline and survive cache clears and app
  updates. Where a server doesn't allow that, the cover is shown straight
  from its URL instead. Stored covers are a cache: never in a backup, and
  dropped (to load again) when the lock changes or the pre-update
  snapshot is restored.
- Covers found by the app are asked for at 1200px, sharp across a phone's
  full width; covers saved earlier at a smaller size are upgraded the same
  way (the old copy shows until the sharper one has loaded).
- **Finding covers and links** (Settings → Data → Covers and links): every
  album without a cover, a year or a link to the chosen service is
  searched on MusicBrainz, and a cover still missing after that — or, for
  Apple Music, the link — on iTunes (Apple's free search, no key; about 20
  requests a minute). Only the artist and
  title leave the device, and no account is needed. The first result with
  the album's artist and title (editions like "Deluxe" or "Remastered"
  ignored, and the artist allowing a typo or two in a longer name) is
  taken without asking — preferring the exact artist, then the album's
  year, then a plain release, then an album over a single — and fills what
  the album
  lacks: cover, year, and the streaming links MusicBrainz has for it, if
  any (well covered for international releases, less for Polish ones; iTunes
  covers Apple Music best). Deezer's own API can't be used — it doesn't
  allow reading from a web page, nor does Odesli (song.link) — and
  Spotify's needs a sign-in. Only albums without a cover
  and with no result of that artist and title are listed to review, where
  the user picks a match or "None of these". A service that can't be
  reached is left out for the rest of the run. It keeps going after
  leaving the covers screen, and stopping keeps what was found. An album
  without a cover also offers "Find a cover" from its own view.
- **Opening an album** looks it up by itself, the same way, when it's
  missing a cover, a year or a link to the chosen service and hasn't been
  tried yet: the cover and the "Open in …" link appear without a tap,
  with pulsing placeholders where they'll show while it searches; "Find a
  cover" is offered only once the search found none.
