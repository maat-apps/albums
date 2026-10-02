import { coverArtUrl, type ReleaseGroup } from "./musicbrainz";
import type { Album } from "./schemas";

// Matching an album to MusicBrainz's search results, and the Spotify search
// link. Pure, so the bulk runner (cover-lookup-runner.ts) and the pick view
// share one definition of "a sure match".

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
  | { kind: "match"; match: ReleaseGroup }
  | { kind: "review" }
  | { kind: "none" };

function sameAlbum(album: Album, group: ReleaseGroup): boolean {
  return (
    normalize(group.title) === normalize(album.title) &&
    normalize(group.artist) === normalize(album.artist)
  );
}

/**
 * A sure match is one with the album's artist and title (and year, when the
 * album has one) — preferring a release group that's an album over a
 * single or EP of the same name. Anything else found waits for review.
 */
export function pickMatch(album: Album, groups: ReleaseGroup[]): LookupOutcome {
  if (groups.length === 0) return { kind: "none" };
  const same = groups.filter(
    (group) =>
      sameAlbum(album, group) &&
      (album.year === null || group.year === album.year),
  );
  const match =
    same.find((group) => group.primaryType === "Album") ?? same.at(0);
  return match ? { kind: "match", match } : { kind: "review" };
}

/** The album with the release group's cover, and its year if it had none. */
export function applyMatch(album: Album, match: ReleaseGroup): Album {
  return {
    ...album,
    coverUrl: coverArtUrl(match.id),
    year: album.year ?? match.year,
    lookup: undefined,
  };
}

/** Albums the bulk lookup still has to try. */
export function needsLookup(album: Album): boolean {
  return !album.coverUrl && album.lookup === undefined;
}

/** Albums whose lookup found candidates for the user to pick from. */
export function awaitsReview(album: Album): boolean {
  return !album.coverUrl && album.lookup === "review";
}

/** Albums the lookup found nothing for. */
export function notFound(album: Album): boolean {
  return !album.coverUrl && album.lookup === "none";
}

/**
 * Spotify's search for the album — no account or API needed, used when the
 * album has no Spotify link of its own.
 */
export function spotifySearchUrl(
  album: Pick<Album, "artist" | "title">,
): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
}
