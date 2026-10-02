import { parseEach } from "@maat-apps/core/validation";
import * as v from "valibot";

import type { Album } from "./schemas";

// MusicBrainz's release-group search and the Cover Art Archive (both free,
// no account, readable from the browser). Only an album's artist and title
// leave the device (PRODUCT.md). MusicBrainz allows about one request per
// second — cover-lookup.ts paces bulk lookups.

const SEARCH_URL = "https://musicbrainz.org/ws/2/release-group/";

export type ReleaseGroup = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  /** "Album", "EP", "Single"… */
  primaryType: string | null;
};

/** MusicBrainz asked us to slow down (HTTP 503/429). */
export class RateLimitedError extends Error {
  constructor() {
    super("MusicBrainz rate limit");
    this.name = "RateLimitedError";
  }
}

const ReleaseGroupSchema = v.object({
  id: v.string(),
  title: v.string(),
  "first-release-date": v.optional(v.string()),
  "primary-type": v.optional(v.string()),
  "artist-credit": v.array(
    v.object({ name: v.string(), joinphrase: v.optional(v.string()) }),
  ),
});

const SearchResultSchema = v.object({
  "release-groups": v.array(v.unknown()),
});

// Lucene's special characters, escaped so a title like "Help!" or "AC/DC"
// is searched for as text.
function escapeLucene(value: string): string {
  return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

export function searchUrl(album: Pick<Album, "artist" | "title">): string {
  const query = `releasegroup:(${escapeLucene(album.title)}) AND artist:(${escapeLucene(album.artist)})`;
  const params = new URLSearchParams({ query, fmt: "json", limit: "8" });
  return `${SEARCH_URL}?${params}`;
}

/** The release group's front cover, 250px, from the Cover Art Archive. */
export function coverArtUrl(releaseGroupId: string): string {
  return `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;
}

/** The release groups in a search response; malformed entries are dropped. */
export function parseReleaseGroups(value: unknown): ReleaseGroup[] {
  if (!v.is(SearchResultSchema, value)) return [];
  return parseEach(ReleaseGroupSchema, value["release-groups"]).map((group) => {
    const year = Number.parseInt(group["first-release-date"] ?? "", 10);
    return {
      id: group.id,
      title: group.title,
      artist: group["artist-credit"]
        .map((credit) => credit.name + (credit.joinphrase ?? ""))
        .join(""),
      year: Number.isNaN(year) ? null : year,
      primaryType: group["primary-type"] ?? null,
    };
  });
}

/** Release groups matching the album's artist and title, best first. */
export async function searchReleaseGroups(
  album: Pick<Album, "artist" | "title">,
  signal?: AbortSignal,
): Promise<ReleaseGroup[]> {
  const response = await fetch(searchUrl(album), {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (response.status === 503 || response.status === 429) {
    throw new RateLimitedError();
  }
  if (!response.ok) throw new Error(`MusicBrainz: HTTP ${response.status}`);
  return parseReleaseGroups(await response.json());
}
