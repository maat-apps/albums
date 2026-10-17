import { createLocalStore } from "@maat-apps/core/local";
import { isRecord } from "@maat-apps/core/validation";

import { mergeAlbums } from "./album-merge";
import {
  getSettingsSnapshot,
  whenLoaded as whenSettingsLoaded,
} from "./app-settings";
import { deleteCover } from "./cover-store";
import { encryptionKey } from "./encryption-key";
import { keyValueStore, kvDelete } from "./idb-store";
import { parseAlbums, type Album, type AlbumStatus } from "./schemas";
import { DATA_KEY, LEGACY_SPOTIFY_KEY } from "./storage-keys";

// The albums in @maat-apps/core/local's store (maat-core's docs/storage.md):
// in memory once loaded, written through to IndexedDB, encrypted with the
// lock's key — the local copy GitHub sync (github-sync.ts) builds on.
// Screens subscribe through src/hooks/use-albums.ts.

/** Whether the enrolled lock encrypts — then the first read waits for its key. */
export async function lockEncrypts(): Promise<boolean> {
  await whenSettingsLoaded();
  return getSettingsSnapshot().lock?.encryptionSupported === true;
}

export const albumsStore = createLocalStore<Album[], { albums: Album[] }>({
  storage: keyValueStore,
  key: DATA_KEY,
  empty: [],
  parse: (stored) => (isRecord(stored) ? parseAlbums(stored.albums) : []),
  serialize: (albums) => ({ albums }),
  encryption: { keyHolder: encryptionKey, encrypts: lockEncrypts },
});

// Spotify was removed from the app: drop the token it left behind, once the
// albums have loaded.
const stopWatchingLoad = albumsStore.subscribe(() => {
  if (!albumsStore.isReady()) return;
  stopWatchingLoad();
  void kvDelete(LEGACY_SPOTIFY_KEY).catch(() => {});
});

/** Starts the background read on first use; test-only to await directly. */
export const whenLoaded = albumsStore.whenLoaded;
export const subscribe = albumsStore.subscribe;
export const getAlbumsSnapshot = albumsStore.getSnapshot;
export const getServerAlbumsSnapshot = albumsStore.getServerSnapshot;

/**
 * Whether the initial read has finished — until then "no such album" can't
 * be told apart from "not loaded yet" (a deep link on a cold start).
 */
export const isAlbumsReady = albumsStore.isReady;
export const isAlbumsReadyOnServer = albumsStore.isReadyOnServer;

function writeAlbums(next: Album[]): void {
  void albumsStore.replace(next);
}

/** Replaces every album — the update snapshot restore and the app lock's rewrite/erase. */
export function replaceAllAlbums(next: Album[]): void {
  writeAlbums(next);
}

/**
 * Adds the albums the device lacks and keeps the newer copy of the rest,
 * as a sync merges them — but with nothing counted as synced, so nothing
 * is deleted.
 */
export function mergeIntoAlbums(incoming: Album[]): void {
  writeAlbums(mergeAlbums(getAlbumsSnapshot(), incoming, new Set()).albums);
}

/** Appends albums in one write (e.g. a CSV import). */
export function addAlbums(added: Album[]): void {
  if (added.length === 0) return;
  writeAlbums([...getAlbumsSnapshot(), ...added]);
}

/** Applies a CSV import — new albums and changed ones — in one write. */
export function applyImport(added: Album[], updated: Album[]): void {
  if (added.length === 0 && updated.length === 0) return;
  const replacements = new Map(updated.map((album) => [album.id, album]));
  writeAlbums([
    ...getAlbumsSnapshot().map((album) => replacements.get(album.id) ?? album),
    ...added,
  ]);
}

/** Saves a new or changed album, stamping `updatedAt`. */
export function saveAlbum(album: Album, now = new Date()): void {
  const saved = { ...album, updatedAt: now.toISOString() };
  const current = getAlbumsSnapshot();
  const exists = current.some((item) => item.id === album.id);
  writeAlbums(
    exists
      ? current.map((item) => (item.id === album.id ? saved : item))
      : [...current, saved],
  );
}

export function setStatus(
  id: string,
  status: AlbumStatus,
  now = new Date(),
): void {
  const album = getAlbumsSnapshot().find((item) => item.id === id);
  if (album) saveAlbum({ ...album, status }, now);
}

export function deleteAlbum(id: string): void {
  const current = getAlbumsSnapshot();
  if (!current.some((album) => album.id === id)) return;
  writeAlbums(current.filter((album) => album.id !== id));
  void deleteCover(id);
}
