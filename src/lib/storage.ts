import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
} from "@maat-apps/core/crypto";
import { isRecord } from "@maat-apps/core/validation";

import { mergeAlbums } from "./album-utils";
import {
  getSettingsSnapshot,
  whenLoaded as whenSettingsLoaded,
} from "./app-settings";
import { deleteCover } from "./cover-store";
import { encryptionKey } from "./encryption-key";
import { kvGet, kvSet } from "./idb-store";
import { parseAlbums, type Album, type AlbumStatus } from "./schemas";
import { DATA_KEY } from "./storage-keys";

// An in-memory copy of the albums is the source of truth once loaded;
// IndexedDB is the write-through backing store — read once in the background
// at startup, written in the background on every change (maat-core's
// docs/storage.md). Screens subscribe through src/hooks/use-albums.ts.

const EMPTY: Album[] = [];

const listeners = new Set<() => void>();
let albums: Album[] = EMPTY;
let loaded: Promise<void> | null = null;
let ready = false;

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function loadAlbums(): Promise<void> {
  await whenSettingsLoaded();
  if (getSettingsSnapshot().lock?.encryptionSupported) {
    // The app sits behind the lock screen until unlock succeeds, so the
    // albums are never needed — and never readable — before the key is.
    await encryptionKey.whenSet();
  }
  try {
    const stored = await kvGet<unknown>(DATA_KEY);
    const key = encryptionKey.get();
    const data =
      key && isEncryptedBlob(stored)
        ? await decryptJson<unknown>(key, stored)
        : stored;
    if (isRecord(data)) albums = parseAlbums(data.albums);
  } catch {
    // Keep what's in memory — same fallback as a corrupt or missing value.
  } finally {
    ready = true;
    emitChange();
  }
}

/** Starts the background read on first use; test-only to await directly. */
export function whenLoaded(): Promise<void> {
  loaded ??= loadAlbums();
  return loaded;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAlbumsSnapshot(): Album[] {
  void whenLoaded();
  return albums;
}

/**
 * Whether the initial read has finished — until then "no such album" can't
 * be told apart from "not loaded yet" (a deep link on a cold start).
 */
export function isAlbumsReady(): boolean {
  void whenLoaded();
  return ready;
}

export function isAlbumsReadyOnServer(): boolean {
  return false;
}

export function getServerAlbumsSnapshot(): Album[] {
  return EMPTY;
}

async function persist(data: { albums: Album[] }): Promise<void> {
  try {
    const key = encryptionKey.get();
    await kvSet(DATA_KEY, key ? await encryptJson(key, data) : data);
  } catch {
    // Best-effort — the in-memory copy (and this tab) already reflects it.
  }
}

function writeAlbums(next: Album[]): void {
  albums = next;
  void persist({ albums: next });
  emitChange();
}

/** Replaces every album — the update snapshot restore and the app lock's rewrite/erase. */
export function replaceAllAlbums(next: Album[]): void {
  writeAlbums(next);
}

/** Adds the albums the device lacks and keeps the newer copy of the rest. */
export function mergeIntoAlbums(incoming: Album[]): void {
  writeAlbums(mergeAlbums(getAlbumsSnapshot(), incoming));
}

/** Appends albums in one write (e.g. a CSV import). */
export function addAlbums(added: Album[]): void {
  if (added.length === 0) return;
  writeAlbums([...getAlbumsSnapshot(), ...added]);
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
