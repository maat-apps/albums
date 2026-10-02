import { parseEach } from "@maat-apps/core/validation";
import * as v from "valibot";

// The single source of truth for runtime validation and the album type. Data
// read back from IndexedDB or a backup is parsed album by album, so one
// malformed album never takes the rest down with it.

export const ALBUM_STATUSES = [
  "toListen",
  "comingBack",
  "notComingBack",
] as const;

export const LOOKUP_RESULTS = ["review", "none", "skipped"] as const;

const HttpsUrlSchema = v.pipe(v.string(), v.url(), v.startsWith("https://"));

const AlbumSchema = v.object({
  id: v.string(),
  year: v.fallback(v.nullable(v.pipe(v.number(), v.integer())), null),
  artist: v.string(),
  title: v.string(),
  status: v.fallback(v.picklist(ALBUM_STATUSES), "toListen"),
  // A malformed URL is dropped rather than dropping the whole album.
  coverUrl: v.fallback(v.optional(HttpsUrlSchema), undefined),
  spotifyUrl: v.fallback(v.optional(HttpsUrlSchema), undefined),
  // The last cover lookup's verdict for an album still without a cover
  // (cover-lookup.ts): "review" — candidates to pick from, "none" — nothing
  // found, "skipped" — the user rejected them. Absent until looked up.
  lookup: v.fallback(v.optional(v.picklist(LOOKUP_RESULTS)), undefined),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export type Album = v.InferOutput<typeof AlbumSchema>;
export type AlbumStatus = Album["status"];

/** Every valid album in `value`; anything else (or a non-array) is dropped. */
export function parseAlbums(value: unknown): Album[] {
  return parseEach(AlbumSchema, value);
}

/** Whether `value` is an https URL an album may link to. */
export function isHttpsUrl(value: string): boolean {
  return v.is(HttpsUrlSchema, value);
}
