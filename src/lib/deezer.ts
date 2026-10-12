import { parseEach } from "@maat-apps/core/validation";
import * as v from "valibot";

import type { AlbumMatch } from "./cover-lookup";
import { RateLimitedError } from "./musicbrainz";
import { isHttpsUrl, type Album } from "./schemas";

// Deezer's public API: free, no account or key. Only an album's artist and
// title leave the device. It allows 50 requests per 5 seconds —
// cover-lookup-runner.ts paces bulk lookups well below that. Search results
// carry the album's link and cover but no release date.

const SEARCH_URL = "https://api.deezer.com/search/album";

// Deezer answers errors with HTTP 200 and this body; code 4 is its quota.
const ErrorSchema = v.object({
  error: v.object({ code: v.optional(v.number()) }),
});
const QUOTA_ERROR = 4;

const DeezerAlbumSchema = v.object({
  id: v.number(),
  title: v.string(),
  link: v.optional(v.string()),
  cover_xl: v.optional(v.nullable(v.string())),
  // Empty for an album without artwork, whose cover URLs are a placeholder.
  md5_image: v.optional(v.string()),
  record_type: v.optional(v.string()),
  artist: v.object({ name: v.string() }),
});

const SearchResultSchema = v.object({ data: v.array(v.unknown()) });

// A double quote would end the advanced-search field early.
const quoted = (value: string) => `"${value.replaceAll('"', " ").trim()}"`;

export function searchUrl(album: Pick<Album, "artist" | "title">): string {
  const params = new URLSearchParams({
    q: `artist:${quoted(album.artist)} album:${quoted(album.title)}`,
    limit: "10",
  });
  return `${SEARCH_URL}?${params}`;
}

/** Deezer's own search for the album, for one without a Deezer link. */
export function deezerSearchUrl(
  album: Pick<Album, "artist" | "title">,
): string {
  return `https://www.deezer.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
}

const httpsOrNull = (url: string | null | undefined) =>
  url && isHttpsUrl(url) ? url : null;

/** The albums in a search response; malformed entries are dropped. */
export function parseDeezerAlbums(value: unknown): AlbumMatch[] {
  if (!v.is(SearchResultSchema, value)) return [];
  return parseEach(DeezerAlbumSchema, value.data).map((item) => ({
    id: String(item.id),
    title: item.title,
    artist: item.artist.name,
    year: null,
    type: item.record_type?.toLowerCase() ?? null,
    coverUrl: item.md5_image === "" ? null : httpsOrNull(item.cover_xl),
    deezerUrl: httpsOrNull(item.link),
  }));
}

/** Deezer's matches for the album, best first. */
export async function searchDeezer(
  album: Pick<Album, "artist" | "title">,
  signal?: AbortSignal,
): Promise<AlbumMatch[]> {
  const response = await fetch(searchUrl(album), {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (response.status === 429) throw new RateLimitedError();
  if (!response.ok) throw new Error(`Deezer: HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (v.is(ErrorSchema, body)) {
    if (body.error.code === QUOTA_ERROR) throw new RateLimitedError();
    throw new Error(`Deezer: error ${body.error.code ?? "unknown"}`);
  }
  return parseDeezerAlbums(body);
}
