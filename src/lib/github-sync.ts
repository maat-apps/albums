import {
  createRepoConnection,
  createRepoSync,
  RepoConnectionError,
  type RepoConnectionState,
  type RepoLocation,
  type SyncedIds,
  syncedIdsExtra,
  type SyncResult,
} from "@maat-apps/core/github";
import type { LocalStore } from "@maat-apps/core/local";

import { albumMerge, rebaseAlbums } from "./album-merge";
import { formatAlbumsFile, parseAlbumsFile } from "./albums-file";
import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import type { Album } from "./schemas";
import { albumsStore, lockEncrypts } from "./storage";
import { GITHUB_KEY } from "./storage-keys";

// Syncing the collection with a JSON file in the user's own GitHub
// repository (PRODUCT.md), on @maat-apps/core/github's two-way mode
// (maat-core's docs/storage-github.md). The connection holds a token that
// can write to that repository, so it's only ever stored encrypted with the
// app lock's key: without a lock that encrypts (WebAuthn PRF) there's no
// connection, and turning the lock off deletes it (app-lock.ts's rewrite).
// Once connected it syncs by itself (`startAutoSync`): on launch, when the
// app comes back to the foreground, and shortly after each change here.

export type GitHubConnection = RepoConnectionState<SyncedIds>;
export type { SyncResult };

/** Not connected, or no key to store the token with. */
export { RepoConnectionError as GitHubSyncError };

export const githubConnection = createRepoConnection({
  storage: keyValueStore,
  key: GITHUB_KEY,
  keyHolder: encryptionKey,
  encrypts: lockEncrypts,
  extra: syncedIdsExtra,
});

// The albums the running sync merged from. Core writes the merge back over
// the store; if the albums changed here meanwhile (an edit during the round
// trip), those edits go on top (`rebaseAlbums`) and the next sync sends them.
let mergedFrom: Album[] = [];
// The albums as this sync leaves them, or null when edits went on top.
let syncResult: Album[] | null = null;
const syncedStore: LocalStore<Album[]> = {
  ...albumsStore,
  getSnapshot() {
    mergedFrom = albumsStore.getSnapshot();
    syncResult = mergedFrom;
    return mergedFrom;
  },
  replace(next) {
    const current = albumsStore.getSnapshot();
    if (current === mergedFrom) {
      syncResult = next;
      return albumsStore.replace(next);
    }
    syncResult = null;
    return albumsStore.replace(rebaseAlbums(mergedFrom, current, next));
  },
};

const repoSync = createRepoSync({
  connection: githubConnection,
  store: syncedStore,
  file: { format: formatAlbumsFile, parse: parseAlbumsFile },
  merge: albumMerge,
  commitMessage: "Update albums from the app",
});

/** Starts the background read on first use; test-only to await directly. */
export const whenGitHubLoaded = githubConnection.whenLoaded;
export const subscribeToGitHub = githubConnection.subscribe;
export const getGitHubConnection = githubConnection.get;
export const getServerGitHubConnection = githubConnection.getServerSnapshot;

/** Whether a token may be stored: the lock is on, encrypts, and is unlocked. */
export const canConnectGitHub = githubConnection.canConnect;

/**
 * Connects after checking the token can read the repository. The file may
 * not exist yet; the first sync creates it.
 */
export function connectGitHub(location: RepoLocation): Promise<void> {
  return githubConnection.connect(location);
}

export const disconnectGitHub = githubConnection.disconnect;

/** The lock's rewrite: re-encrypt under the new key, or delete without one. */
export const rewriteGitHubConnection = githubConnection.rewrite;

export type GitHubSyncStatus = {
  syncing: boolean;
  /** Why the last sync failed; null once one succeeds. */
  error: unknown;
};

let status: GitHubSyncStatus = { syncing: false, error: null };
const statusListeners = new Set<() => void>();

function setStatus(next: GitHubSyncStatus): void {
  status = next;
  for (const listener of statusListeners) listener();
}

export const getGitHubSyncStatus = (): GitHubSyncStatus => status;
export const getServerGitHubSyncStatus = (): GitHubSyncStatus => ({
  syncing: false,
  error: null,
});
export function subscribeToGitHubSync(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

let running: Promise<SyncResult> | null = null;
// The albums as the last sync left them, and when it finished.
let syncedAlbums: Album[] | null = null;
let syncedAt = 0;

/**
 * Merges this device's albums with the file's, writes the result to both,
 * and remembers what was synced. If the file changes on GitHub meanwhile
 * (e.g. the repository's own workflow fills in covers), starts over once.
 * A call while one runs shares it.
 */
export function syncWithGitHub(): Promise<SyncResult> {
  if (running) return running;
  setStatus({ syncing: true, error: status.error });
  running = repoSync
    .sync()
    .then(
      (result) => {
        syncedAlbums = syncResult;
        syncedAt = Date.now();
        setStatus({ syncing: false, error: null });
        return result;
      },
      (error: unknown) => {
        setStatus({ syncing: false, error });
        throw error;
      },
    )
    .finally(() => {
      running = null;
    });
  return running;
}

/** How long after a change the automatic sync waits for more. */
export const AUTO_SYNC_DELAY_MS = 5000;
/** Coming back to the app syncs only if the last sync is older than this. */
export const RESUME_SYNC_AFTER_MS = 60_000;

/**
 * Syncs when connected; a failure only lands in the status (Settings shows
 * it). With `onlyIfChanged`, not when the albums are as the last sync left
 * them; one already running is followed by another once it ends.
 */
async function autoSync({ onlyIfChanged = false } = {}): Promise<void> {
  await githubConnection.whenLoaded();
  if (!githubConnection.get()) return;
  if (running) {
    await running.catch(() => {});
    return autoSync({ onlyIfChanged: true });
  }
  if (onlyIfChanged && albumsStore.getSnapshot() === syncedAlbums) return;
  await syncWithGitHub().catch(() => {});
}

/**
 * Syncs now, right after connecting, a few seconds after the albums change
 * here, and when the app comes back to the foreground after a while.
 * Returns the stop function.
 */
export function startAutoSync({
  delayMs = AUTO_SYNC_DELAY_MS,
  resumeAfterMs = RESUME_SYNC_AFTER_MS,
} = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connected = githubConnection.get() !== null;
  const stopWatchingConnection = githubConnection.subscribe(() => {
    const now = githubConnection.get() !== null;
    if (now && !connected) void autoSync();
    connected = now;
  });
  const stopWatching = albumsStore.subscribe(() => {
    if (!albumsStore.isReady()) return;
    clearTimeout(timer);
    timer = setTimeout(() => void autoSync({ onlyIfChanged: true }), delayMs);
  });
  function onVisibilityChange() {
    if (
      document.visibilityState === "visible" &&
      Date.now() - syncedAt > resumeAfterMs
    ) {
      void autoSync();
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  void autoSync();
  return () => {
    clearTimeout(timer);
    stopWatching();
    stopWatchingConnection();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
