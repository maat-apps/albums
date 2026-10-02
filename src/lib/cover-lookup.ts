import type { Album } from "./schemas";

// Matching an album to search results — from MusicBrainz, or from Spotify
// once it's connected — and the Spotify search link. Pure, so the bulk
// runner (cover-lookup-runner.ts) and the pick view share one definition of
// "a sure match".

export type LookupSource = "musicbrainz" | "spotify";

/** One search result, whichever service it came from. */
export type AlbumMatch = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  /** "album", "single", "ep"… (lower case). */
  type: string | null;
  coverUrl: string | null;
  spotifyUrl: string | null;
};

/**
 * Comparable text: lower case, no diacritics, punctuation or bracketed
 * suffixes ("(Remastered)", "[Deluxe]"), "&" read as "and", no leading
 * "the".
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

export type LookupOutcome =
  { kind: "match"; match: AlbumMatch } | { kind: "review" } | { kind: "none" };

function sameAlbum(album: Album, match: AlbumMatch): boolean {
  return (
    normalize(match.title) === normalize(album.title) &&
    normalize(match.artist) === normalize(album.artist) &&
    (album.year === null || match.year === album.year)
  );
}

/**
 * A sure match is one with the album's artist and title (and year, when the
 * album has one) — preferring an album over a single or EP of the same
 * name. Anything else found waits for review.
 */
export function pickMatch(album: Album, matches: AlbumMatch[]): LookupOutcome {
  if (matches.length === 0) return { kind: "none" };
  const same = matches.filter((match) => sameAlbum(album, match));
  const match = same.find((item) => item.type === "album") ?? same.at(0);
  return match ? { kind: "match", match } : { kind: "review" };
}

/**
 * The album with what the match adds — a cover, a Spotify link, a year —
 * where it had none; the lookup verdicts are cleared.
 */
export function applyMatch(album: Album, match: AlbumMatch): Album {
  return {
    ...album,
    coverUrl: album.coverUrl ?? match.coverUrl ?? undefined,
    spotifyUrl: album.spotifyUrl ?? match.spotifyUrl ?? undefined,
    year: album.year ?? match.year,
    lookup: undefined,
    spotifyLookup: undefined,
  };
}

/** What a lookup from `source` can still add to the album. */
function isMissing(album: Album, source: LookupSource): boolean {
  return source === "spotify"
    ? !album.coverUrl || !album.spotifyUrl
    : !album.coverUrl;
}

function verdict(album: Album, source: LookupSource) {
  return source === "spotify" ? album.spotifyLookup : album.lookup;
}

/** The album with `source`'s lookup verdict recorded. */
export function withVerdict(
  album: Album,
  source: LookupSource,
  result: NonNullable<Album["lookup"]>,
): Album {
  return source === "spotify"
    ? { ...album, spotifyLookup: result }
    : { ...album, lookup: result };
}

/** Albums a bulk lookup from `source` still has to try. */
export function needsLookup(album: Album, source: LookupSource): boolean {
  return isMissing(album, source) && verdict(album, source) === undefined;
}

/** Albums whose lookup found candidates for the user to pick from. */
export function awaitsReview(album: Album, source: LookupSource): boolean {
  return isMissing(album, source) && verdict(album, source) === "review";
}

/** Albums the lookup found nothing for. */
export function notFound(album: Album, source: LookupSource): boolean {
  return isMissing(album, source) && verdict(album, source) === "none";
}

/**
 * Spotify's search for the album — used when the album has no Spotify link
 * of its own.
 */
export function spotifySearchUrl(
  album: Pick<Album, "artist" | "title">,
): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
}
