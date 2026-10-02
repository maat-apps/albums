import {
  decryptJson,
  encryptJson,
  fromBase64Url,
  isEncryptedBlob,
  toBase64Url,
} from "@maat-apps/core/crypto";
import { isRecord } from "@maat-apps/core/validation";

import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import type { Album } from "./schemas";
import { COVER_INDEX_KEY, coverKey } from "./storage-keys";

// Covers are fetched once from their URL and kept in IndexedDB, so they
// work offline and survive cache clears and app updates (PRODUCT.md,
// maat-core#77). They're a cache, never part of a backup: anything can be
// fetched again. Stored per album id — not per URL, which would reveal the
// collection in plain key names even when the data is encrypted — and
// encrypted with the lock's key like the albums themselves.

/** Covers bigger than this aren't kept (they're still shown from the URL). */
export const MAX_COVER_BYTES = 2_000_000;

type StoredCover = { url: string; type: string; data: string };

function isStoredCover(value: unknown): value is StoredCover {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.type === "string" &&
    typeof value.data === "string"
  );
}

// Calls go through keyValueStore (not kvGet & co.) so tests can make a
// read or write fail. The ids with a stored cover — the store can't list its keys, so clearing
// every cover needs this. Updates are serialized: covers load in parallel,
// and racing read-modify-writes would lose ids.
let indexQueue: Promise<unknown> = Promise.resolve();

function updateIndex(change: (ids: string[]) => string[]): Promise<void> {
  const next = indexQueue.then(async () => {
    const ids = (await keyValueStore.get<string[]>(COVER_INDEX_KEY)) ?? [];
    await keyValueStore.set(COVER_INDEX_KEY, change(ids));
  });
  indexQueue = next.catch(() => undefined);
  return next;
}

async function readCover(albumId: string): Promise<StoredCover | null> {
  try {
    const stored = await keyValueStore.get<unknown>(coverKey(albumId));
    const key = encryptionKey.get();
    if (isEncryptedBlob(stored)) {
      if (!key) return null;
      const value = await decryptJson<unknown>(key, stored);
      return isStoredCover(value) ? value : null;
    }
    return isStoredCover(stored) ? stored : null;
  } catch {
    // Unreadable (e.g. encrypted with a key that's gone): fetch it again.
    return null;
  }
}

async function writeCover(albumId: string, cover: StoredCover): Promise<void> {
  const key = encryptionKey.get();
  await keyValueStore.set(
    coverKey(albumId),
    key ? await encryptJson(key, cover) : cover,
  );
  await updateIndex((ids) => (ids.includes(albumId) ? ids : [...ids, albumId]));
}

function toBlob(cover: StoredCover): Blob {
  return new Blob([fromBase64Url(cover.data)], { type: cover.type });
}

async function fetchCover(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    // Offline, or the server doesn't allow the app to read the image.
    return null;
  }
}

/**
 * The album's cover as a local Blob — from IndexedDB when it's been stored
 * for the current URL, otherwise fetched and stored. `null` means "show the
 * URL directly" (no CORS, too big, offline before it was ever stored).
 */
export async function loadCover(
  album: Pick<Album, "id" | "coverUrl">,
): Promise<Blob | null> {
  const url = album.coverUrl;
  if (!url) return null;
  const stored = await readCover(album.id);
  if (stored?.url === url) return toBlob(stored);
  const blob = await fetchCover(url);
  if (!blob) return null;
  if (blob.size <= MAX_COVER_BYTES) {
    const data = toBase64Url(new Uint8Array(await blob.arrayBuffer()));
    try {
      await writeCover(album.id, { url, type: blob.type, data });
    } catch {
      // Best-effort (e.g. storage full) — the image still shows this time.
    }
  }
  return blob;
}

export async function deleteCover(albumId: string): Promise<void> {
  await keyValueStore.delete(coverKey(albumId));
  await updateIndex((ids) => ids.filter((id) => id !== albumId));
}

/** Drops every stored cover — they load again from their URLs. */
export async function clearCovers(): Promise<void> {
  let ids: string[] = [];
  await updateIndex((current) => {
    ids = current;
    return [];
  });
  await Promise.all(ids.map((id) => keyValueStore.delete(coverKey(id))));
}
