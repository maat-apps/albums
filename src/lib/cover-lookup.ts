import type { Album } from "./schemas";

// Matching an album to search results — from MusicBrainz, or from Spotify
// once it's connected — and the Spotify search link. Pure, so the bulk
// runner (cover-lookup-runner.ts) and the pick view share one definition of
// "a sure match".

export type LookupSource = "musicbrainz" | "spotify" | "itunes";

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

// Words that only mark a reissue ("Deluxe Edition", "2009 Remaster"): left
// off the end of a title when comparing, so the original matches them all.
const EDITION_WORDS = new Set([
  "remaster",
  "remastered",
  "deluxe",
  "expanded",
  "edition",
  "version",
  "anniversary",
  "reissue",
  "bonus",
  "track",
  "tracks",
  "special",
  "limited",
  "collectors",
  "collector",
  "super",
  "legacy",
  "mono",
  "stereo",
]);

const EDITION_PATTERN =
  /remaster|deluxe|expanded|edition|version|anniversary|reissue|bonus/i;

const isCount = (word: string) => /^\d+(st|nd|rd|th)?$/.test(word);

function withoutEditionWords(text: string): string {
  const words = text.split(" ");
  let end = words.length;
  let stripped = false;
  while (end > 1) {
    const word = words[end - 1];
    if (EDITION_WORDS.has(word) || (stripped && isCount(word))) {
      stripped ||= EDITION_WORDS.has(word);
      end--;
    } else {
      break;
    }
  }
  return words.slice(0, end).join(" ");
}

/**
 * Comparable text: lower case, no diacritics, punctuation, bracketed
 * suffixes ("(Remastered)", "[Deluxe]") or trailing edition words
 * ("Deluxe Edition", "- 2009 Remaster"), "&" read as "and", no leading
 * "the".
 */
export function normalize(text: string): string {
  const plain = text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return withoutEditionWords(plain).replace(/^the /, "");
}

export type LookupOutcome =
  { kind: "match"; match: AlbumMatch } | { kind: "review" } | { kind: "none" };

function sameAlbum(album: Album, match: AlbumMatch): boolean {
  return (
    normalize(match.title) === normalize(album.title) &&
    normalize(match.artist) === normalize(album.artist)
  );
}

// Between releases of the same album: the album's own year, then the plain
// release over a deluxe or remaster, then an album over a single or EP.
function rank(album: Album, match: AlbumMatch): number {
  const sameYear = album.year === null || match.year === album.year;
  return (
    (sameYear ? 4 : 0) +
    (EDITION_PATTERN.test(match.title) ? 0 : 2) +
    (match.type === "album" ? 1 : 0)
  );
}

/**
 * The first found release with the album's artist and title — editions
 * ignored — that ranks best (see `rank`); a different year doesn't stop it.
 * Results with another artist or title wait for review.
 */
export function pickMatch(album: Album, matches: AlbumMatch[]): LookupOutcome {
  if (matches.length === 0) return { kind: "none" };
  let best: AlbumMatch | undefined;
  for (const match of matches) {
    if (!sameAlbum(album, match)) continue;
    if (!best || rank(album, match) > rank(album, best)) best = match;
  }
  return best ? { kind: "match", match: best } : { kind: "review" };
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
    itunesLookup: undefined,
  };
}

/** What a lookup from `source` can still add to the album. */
function isMissing(album: Album, source: LookupSource): boolean {
  return source === "spotify"
    ? !album.coverUrl || !album.spotifyUrl
    : !album.coverUrl;
}

const VERDICT_FIELDS = {
  musicbrainz: "lookup",
  spotify: "spotifyLookup",
  itunes: "itunesLookup",
} as const;

function verdict(album: Album, source: LookupSource) {
  return album[VERDICT_FIELDS[source]];
}

/** The album with `source`'s lookup verdict recorded. */
export function withVerdict(
  album: Album,
  source: LookupSource,
  result: NonNullable<Album["lookup"]>,
): Album {
  return { ...album, [VERDICT_FIELDS[source]]: result };
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
