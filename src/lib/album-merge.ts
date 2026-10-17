import { mergeById, type MergeOptions } from "@maat-apps/core/github";

import { sameAlbum } from "./album-utils";
import { toFileAlbum } from "./albums-file";
import type { Album } from "./schemas";

// Merging this device's albums with the GitHub file's (github-sync.ts), on
// core's mergeById: matched by id, `syncedIds` telling a deletion from an
// addition. What's albums' own: one edited on both sides keeps the newer
// edit (`updatedAt`) with the links, cover and year the other side has
// filled in where it has none — the data repository's workflow fills those
// in on its own — and before the first sync, an album the file has under
// another id is matched as the same record (`sameAlbum`) rather than kept
// twice.

const FILLABLE_FIELDS = [
  "coverUrl",
  "deezerUrl",
  "spotifyUrl",
  "appleMusicUrl",
] as const;

export type MergeResult = {
  albums: Album[];
  /** Changes to this device's collection. */
  added: number;
  updated: number;
  removed: number;
};

function combine(local: Album, remote: Album): Album {
  const localIsNewer =
    Date.parse(local.updatedAt) > Date.parse(remote.updatedAt);
  const [newer, older] = localIsNewer ? [local, remote] : [remote, local];
  const merged: Album = {
    ...newer,
    id: remote.id,
    year: newer.year ?? older.year,
    // This device's lookup verdicts — never in the file.
    lookup: local.lookup,
    linksLookup: local.linksLookup,
    itunesLookup: local.itunesLookup,
  };
  for (const field of FILLABLE_FIELDS) merged[field] ??= older[field];
  return merged;
}

/** How albums merge, for core's mergeById and createRepoSync. */
export const albumMerge: MergeOptions<Album> = {
  pair: sameAlbum,
  combine,
  same: (a, b) =>
    JSON.stringify(toFileAlbum(a)) === JSON.stringify(toFileAlbum(b)),
};

export function mergeAlbums(
  local: Album[],
  remote: Album[],
  syncedIds: ReadonlySet<string>,
): MergeResult {
  const { items, ...counts } = mergeById(local, remote, syncedIds, albumMerge);
  return { albums: items, ...counts };
}

/**
 * A sync's result with what changed here while it ran: `merged` came from
 * `base`, and `current` is `base` plus this device's edits since — kept
 * (changed or added), or still deleted. The next sync sends them.
 */
export function rebaseAlbums(
  base: Album[],
  current: Album[],
  merged: Album[],
): Album[] {
  const before = new Map(base.map((album) => [album.id, album]));
  const now = new Map(current.map((album) => [album.id, album]));
  const edited = (album: Album) => before.get(album.id) !== album;
  const kept = merged.flatMap((album) => {
    if (before.has(album.id) && !now.has(album.id)) return [];
    const local = now.get(album.id);
    return [local && edited(local) ? local : album];
  });
  const ids = new Set(kept.map((album) => album.id));
  return [
    ...kept,
    ...current.filter((album) => !ids.has(album.id) && edited(album)),
  ];
}
