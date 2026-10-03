import { parseEach } from "@maat-apps/core/validation";
import * as v from "valibot";

import type { AlbumMatch } from "./cover-lookup";
import { RateLimitedError } from "./musicbrainz";
import type { Album } from "./schemas";

// Apple's iTunes Search API: free, no account or key, readable from the
// browser. Only an album's artist and title leave the device. It allows
// about 20 requests a minute — cover-lookup-runner.ts paces bulk lookups.

const SEARCH_URL = "https://itunes.apple.com/search";

const ItunesAlbumSchema = v.object({
  collectionId: v.number(),
  collectionName: v.string(),
  artistName: v.string(),
  artworkUrl100: v.optional(v.string()),
  releaseDate: v.optional(v.string()),
});

const SearchResultSchema = v.object({ results: v.array(v.unknown()) });

// Singles and EPs are named "Title - Single" / "Title - EP".
const RELEASE_TYPE_SUFFIX = /\s+-\s+(single|ep)$/i;

export function searchUrl(album: Pick<Album, "artist" | "title">): string {
  const params = new URLSearchParams({
    term: `${album.artist} ${album.title}`,
    media: "music",
    entity: "album",
    limit: "10",
  });
  return `${SEARCH_URL}?${params}`;
}

/** The 100px artwork URL asked for at 600px instead. */
export function largerArtwork(url: string): string {
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/, "/600x600bb.$2");
}

/** The albums in a search response; malformed entries are dropped. */
export function parseItunesAlbums(value: unknown): AlbumMatch[] {
  if (!v.is(SearchResultSchema, value)) return [];
  return parseEach(ItunesAlbumSchema, value.results).map((item) => {
    const year = Number.parseInt(item.releaseDate ?? "", 10);
    const suffix = RELEASE_TYPE_SUFFIX.exec(item.collectionName)?.[1];
    return {
      id: String(item.collectionId),
      title: item.collectionName.replace(RELEASE_TYPE_SUFFIX, ""),
      artist: item.artistName,
      year: Number.isNaN(year) ? null : year,
      type: suffix?.toLowerCase() ?? "album",
      coverUrl: item.artworkUrl100 ? largerArtwork(item.artworkUrl100) : null,
      spotifyUrl: null,
    };
  });
}

/** iTunes' matches for the album, best first. */
export async function searchItunes(
  album: Pick<Album, "artist" | "title">,
  signal?: AbortSignal,
): Promise<AlbumMatch[]> {
  const response = await fetch(searchUrl(album), {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  // Over its limit, Apple answers 403 (sometimes 429).
  if (response.status === 403 || response.status === 429) {
    throw new RateLimitedError();
  }
  if (!response.ok) throw new Error(`iTunes: HTTP ${response.status}`);
  return parseItunesAlbums(await response.json());
}
