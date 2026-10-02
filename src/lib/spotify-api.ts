import * as v from "valibot";

import type { AlbumMatch } from "./cover-lookup";
import { RateLimitedError } from "./musicbrainz";
import type { Album } from "./schemas";
import { getAccessToken } from "./spotify-session";

// Spotify's album search (Web API), with the connected user's token. Only
// the album's artist and title are sent.

const SEARCH_URL = "https://api.spotify.com/v1/search";

const SpotifyAlbumSchema = v.object({
  id: v.string(),
  name: v.string(),
  album_type: v.optional(v.string()),
  release_date: v.optional(v.string()),
  artists: v.array(v.object({ name: v.string() })),
  images: v.optional(v.array(v.object({ url: v.string() }))),
  external_urls: v.object({ spotify: v.optional(v.string()) }),
});

const SearchResultSchema = v.object({
  albums: v.object({ items: v.array(v.unknown()) }),
});

export function spotifySearchQuery(
  album: Pick<Album, "artist" | "title">,
): string {
  // Field filters narrow the search; quotes would make it too strict.
  const clean = (text: string) => text.replace(/[:"]/g, " ");
  return `album:${clean(album.title)} artist:${clean(album.artist)}`;
}

/** The albums in a search response; malformed entries are dropped. */
export function parseSpotifyAlbums(value: unknown): AlbumMatch[] {
  if (!v.is(SearchResultSchema, value)) return [];
  return value.albums.items.flatMap((item) => {
    if (!v.is(SpotifyAlbumSchema, item)) return [];
    const year = Number.parseInt(item.release_date ?? "", 10);
    return [
      {
        id: item.id,
        title: item.name,
        artist: item.artists.map((artist) => artist.name).join(", "),
        year: Number.isNaN(year) ? null : year,
        type: item.album_type?.toLowerCase() ?? null,
        // Largest first in Spotify's list (640px).
        coverUrl: item.images?.[0]?.url ?? null,
        spotifyUrl: item.external_urls.spotify ?? null,
      },
    ];
  });
}

async function request(
  url: string,
  signal: AbortSignal | undefined,
  force: boolean,
): Promise<Response> {
  return fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${await getAccessToken(force)}` },
    credentials: "omit",
  });
}

/** Spotify's matches for the album, best first. */
export async function searchSpotify(
  album: Pick<Album, "artist" | "title">,
  signal?: AbortSignal,
): Promise<AlbumMatch[]> {
  const params = new URLSearchParams({
    q: spotifySearchQuery(album),
    type: "album",
    limit: "10",
  });
  const url = `${SEARCH_URL}?${params}`;
  let response = await request(url, signal, false);
  // An access token Spotify no longer accepts: refresh once and retry.
  if (response.status === 401) response = await request(url, signal, true);
  if (response.status === 429) {
    const seconds = Number.parseInt(
      response.headers.get("Retry-After") ?? "",
      10,
    );
    throw new RateLimitedError(Number.isNaN(seconds) ? null : seconds * 1000);
  }
  if (!response.ok) throw new Error(`Spotify: HTTP ${response.status}`);
  return parseSpotifyAlbums(await response.json());
}
