import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
} from "@maat-apps/core/crypto";
import { isRecord } from "@maat-apps/core/validation";

import { mergeAlbums } from "./album-merge";
import { formatAlbumsFile, parseAlbumsFile } from "./albums-file";
import {
  getSettingsSnapshot,
  whenLoaded as whenSettingsLoaded,
} from "./app-settings";
import { encryptionKey } from "./encryption-key";
import {
  GitHubError,
  readRepoFile,
  writeRepoFile,
  type RepoFileLocation,
} from "./github";
import { kvDelete, kvGet, kvSet } from "./idb-store";
import { getAlbumsSnapshot, replaceAllAlbums } from "./storage";
import { GITHUB_KEY } from "./storage-keys";

// Syncing the collection with a JSON file in the user's own GitHub
// repository (PRODUCT.md). The connection holds a token that can write to
// that repository, so it's only ever stored encrypted with the app lock's
// key: without a lock that encrypts (WebAuthn PRF) there's no connection,
// and turning the lock off deletes it (app-lock.ts's rewrite).

export type GitHubConnection = RepoFileLocation & {
  /** The albums both sides had after the last sync (album-merge.ts). */
  syncedIds: string[];
};

export type SyncResult = {
  added: number;
  updated: number;
  removed: number;
  /** Whether the file on GitHub was changed. */
  pushed: boolean;
};

export class GitHubSyncError extends Error {}

const COMMIT_MESSAGE = "Update albums from the app";

const listeners = new Set<() => void>();
let connection: GitHubConnection | null = null;
let loaded: Promise<void> | null = null;

function emitChange(): void {
  for (const listener of listeners) listener();
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseConnection(value: unknown): GitHubConnection | null {
  if (!isRecord(value)) return null;
  const { owner, repo, branch, path, token, syncedIds } = value;
  if (
    typeof owner !== "string" ||
    typeof repo !== "string" ||
    typeof branch !== "string" ||
    typeof path !== "string" ||
    typeof token !== "string" ||
    !isStringArray(syncedIds)
  ) {
    return null;
  }
  return { owner, repo, branch, path, token, syncedIds };
}

async function loadConnection(): Promise<void> {
  await whenSettingsLoaded();
  // Never stored without an encrypting lock, so there's nothing to read.
  if (!getSettingsSnapshot().lock?.encryptionSupported) return;
  await encryptionKey.whenSet();
  try {
    const stored = await kvGet<unknown>(GITHUB_KEY);
    const key = encryptionKey.get();
    if (key && isEncryptedBlob(stored)) {
      const read = parseConnection(await decryptJson<unknown>(key, stored));
      // The lock may have been turned off (deleting it) in the meantime.
      if (canConnectGitHub()) connection = read;
    }
  } catch {
    // Unreadable: the user connects again.
  } finally {
    emitChange();
  }
}

/** Starts the background read on first use; test-only to await directly. */
export function whenGitHubLoaded(): Promise<void> {
  loaded ??= loadConnection();
  return loaded;
}

export function subscribeToGitHub(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGitHubConnection(): GitHubConnection | null {
  void whenGitHubLoaded();
  return connection;
}

export function getServerGitHubConnection(): GitHubConnection | null {
  return null;
}

/** Whether a token may be stored: the lock is on, encrypts, and is unlocked. */
export function canConnectGitHub(): boolean {
  return (
    getSettingsSnapshot().lock?.encryptionSupported === true &&
    encryptionKey.get() !== null
  );
}

async function saveConnection(next: GitHubConnection): Promise<void> {
  const key = encryptionKey.get();
  if (!key) throw new GitHubSyncError("No encryption key to store the token.");
  connection = next;
  emitChange();
  await kvSet(GITHUB_KEY, await encryptJson(key, next));
}

/**
 * Connects after checking the token can read the repository. The file may
 * not exist yet; the first sync creates it.
 */
export async function connectGitHub(location: RepoFileLocation): Promise<void> {
  if (!canConnectGitHub()) {
    throw new GitHubSyncError("The app lock must encrypt to store a token.");
  }
  await readRepoFile(location);
  await saveConnection({ ...location, syncedIds: [] });
}

export async function disconnectGitHub(): Promise<void> {
  connection = null;
  emitChange();
  await kvDelete(GITHUB_KEY);
}

/** The lock's rewrite: re-encrypt under the new key, or delete without one. */
export async function rewriteGitHubConnection(): Promise<void> {
  const current = connection;
  if (current && canConnectGitHub()) {
    await saveConnection(current);
  } else {
    await disconnectGitHub();
  }
}

/**
 * Merges this device's albums with the file's, writes the result to both,
 * and remembers what was synced. If the file changes on GitHub meanwhile
 * (e.g. the repository's own workflow fills in covers), starts over once.
 */
export async function syncWithGitHub(): Promise<SyncResult> {
  const current = connection;
  if (!current) throw new GitHubSyncError("Not connected to GitHub.");
  for (let attempt = 0; ; attempt++) {
    const remote = await readRepoFile(current);
    const local = getAlbumsSnapshot();
    const { albums, added, updated, removed } = mergeAlbums(
      local,
      remote ? parseAlbumsFile(remote.text) : [],
      new Set(current.syncedIds),
    );
    const text = formatAlbumsFile(albums);
    const pushed = text !== remote?.text;
    if (pushed) {
      try {
        await writeRepoFile(current, text, remote?.sha ?? null, COMMIT_MESSAGE);
      } catch (error) {
        if (error instanceof GitHubError && error.kind === "conflict") {
          if (attempt === 0) continue;
        }
        throw error;
      }
    }
    if (added + updated + removed > 0) replaceAllAlbums(albums);
    await saveConnection({
      ...current,
      syncedIds: albums.map((album) => album.id),
    });
    return { added, updated, removed, pushed };
  }
}
