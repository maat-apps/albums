import type { Album } from "./schemas";
import {
  linkTo,
  withLinks,
  type StreamingLinks,
  type StreamingService,
} from "./streaming";

// Matching an album to search results — from MusicBrainz or iTunes. Pure,
// so the bulk runner (cover-lookup-runner.ts) and the pick view share one
// definition of "a sure match", and of what an album still misses for the
// user's streaming service.

export type LookupSource = "musicbrainz" | "itunes";

/** One search result, whichever service it came from. */
export type AlbumMatch = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  /** "album", "single", "ep"… (lower case). */
  type: string | null;
  coverUrl: string | null;
  /** Streaming links the result itself carries (iTunes: Apple Music). */
  links: StreamingLinks;
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

/** The number of single-letter edits between `a` and `b`. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Whether two (normalized) artist names are the same but for a typo: one
 * edit in a name of 5+ letters, two in one of 12+ ("Manouvres" for
 * "Manoeuvres"). Shorter names must match exactly.
 */
function sameArtist(a: string, b: string): boolean {
  if (a === b) return true;
  const length = Math.min(a.length, b.length);
  const allowed = length >= 12 ? 2 : length >= 5 ? 1 : 0;
  return editDistance(a, b) <= allowed;
}

function sameAlbum(album: Album, match: AlbumMatch): boolean {
  return (
    normalize(match.title) === normalize(album.title) &&
    sameArtist(normalize(match.artist), normalize(album.artist))
  );
}

// Between releases of the same album: the artist's exact name over a typo,
// then the album's own year, then the plain release over a deluxe or
// remaster, then an album over a single or EP.
function rank(album: Album, match: AlbumMatch): number {
  const sameYear = album.year === null || match.year === album.year;
  const exactArtist = normalize(match.artist) === normalize(album.artist);
  return (
    (exactArtist ? 8 : 0) +
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
 * The album with what the match adds — a cover, a year, streaming links —
 * where it had none; the search verdicts are cleared.
 */
export function applyMatch(album: Album, match: AlbumMatch): Album {
  return {
    ...withLinks(album, match.links),
    coverUrl: album.coverUrl ?? match.coverUrl ?? undefined,
    year: album.year ?? match.year,
    lookup: undefined,
    itunesLookup: undefined,
  };
}

/**
 * Whether the album has no link to `service` and MusicBrainz's links for it
 * weren't read yet (cover-lookup-runner.ts reads them after a match).
 */
export function wantsLinks(album: Album, service: StreamingService): boolean {
  return !linkTo(album, service) && album.linksLookup === undefined;
}

/**
 * What a lookup from `source` can still add to the album: a cover from
 * either; a year or the `service` link from MusicBrainz; an Apple Music
 * link from iTunes.
 */
function isMissing(
  album: Album,
  source: LookupSource,
  service: StreamingService,
): boolean {
  if (!album.coverUrl) return true;
  if (source === "musicbrainz") {
    return album.year === null || wantsLinks(album, service);
  }
  return service === "appleMusic" && !album.appleMusicUrl;
}

const VERDICT_FIELDS = {
  musicbrainz: "lookup",
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

/** Albums a lookup from `source` still has to try, for `service`'s link. */
export function needsLookup(
  album: Album,
  source: LookupSource,
  service: StreamingService,
): boolean {
  return (
    isMissing(album, source, service) && verdict(album, source) === undefined
  );
}

/** Albums without a cover whose lookup found candidates to pick from. */
export function awaitsReview(album: Album, source: LookupSource): boolean {
  return !album.coverUrl && verdict(album, source) === "review";
}

/** Albums without a cover the lookup found nothing for. */
export function notFound(album: Album, source: LookupSource): boolean {
  return !album.coverUrl && verdict(album, source) === "none";
}
