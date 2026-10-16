import { sameAlbum } from "./album-utils";
import { toFileAlbum } from "./albums-file";
import type { Album } from "./schemas";

// Merging this device's albums with the GitHub file's (github-sync.ts).
// Albums are matched by id; one edited on both sides keeps the newer edit
// (`updatedAt`), with links and a cover the other side has filled in where
// it has none — the data repository's workflow fills those in on its own.
// `syncedIds` (the albums both sides had after the last sync) tells a
// deletion from an addition: an album missing on one side that was synced
// before was deleted there. Before the first sync, an album the file has
// under another id is matched as the same record (`sameAlbum`) rather than
// kept twice.

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

function sameContent(a: Album, b: Album): boolean {
  return JSON.stringify(toFileAlbum(a)) === JSON.stringify(toFileAlbum(b));
}

export function mergeAlbums(
  local: Album[],
  remote: Album[],
  syncedIds: ReadonlySet<string>,
): MergeResult {
  const localById = new Map(local.map((album) => [album.id, album]));
  const remoteIds = new Set(remote.map((album) => album.id));
  // Never synced and not in the file by id: may be in it under another id.
  const unpaired = local.filter(
    (album) => !remoteIds.has(album.id) && !syncedIds.has(album.id),
  );
  const consumed = new Set<string>();
  const result: MergeResult = { albums: [], added: 0, updated: 0, removed: 0 };

  for (const remoteAlbum of remote) {
    const localAlbum =
      localById.get(remoteAlbum.id) ??
      unpaired.find(
        (album) => !consumed.has(album.id) && sameAlbum(album, remoteAlbum),
      );
    if (!localAlbum) {
      // Deleted here since the last sync, or new in the file.
      if (syncedIds.has(remoteAlbum.id)) continue;
      result.albums.push(remoteAlbum);
      result.added++;
      continue;
    }
    consumed.add(localAlbum.id);
    const merged = combine(localAlbum, remoteAlbum);
    if (!sameContent(merged, localAlbum)) result.updated++;
    result.albums.push(merged);
  }

  for (const album of local) {
    if (consumed.has(album.id)) continue;
    // Deleted in the file since the last sync, or new here.
    if (syncedIds.has(album.id)) {
      result.removed++;
      continue;
    }
    result.albums.push(album);
  }
  return result;
}
