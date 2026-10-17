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

import { albumMerge } from "./album-merge";
import { formatAlbumsFile, parseAlbumsFile } from "./albums-file";
import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import { albumsStore, lockEncrypts } from "./storage";
import { GITHUB_KEY } from "./storage-keys";

// Syncing the collection with a JSON file in the user's own GitHub
// repository (PRODUCT.md), on @maat-apps/core/github's two-way mode
// (maat-core's docs/storage-github.md). The connection holds a token that
// can write to that repository, so it's only ever stored encrypted with the
// app lock's key: without a lock that encrypts (WebAuthn PRF) there's no
// connection, and turning the lock off deletes it (app-lock.ts's rewrite).

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

const repoSync = createRepoSync({
  connection: githubConnection,
  store: albumsStore,
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

/**
 * Merges this device's albums with the file's, writes the result to both,
 * and remembers what was synced. If the file changes on GitHub meanwhile
 * (e.g. the repository's own workflow fills in covers), starts over once.
 */
export function syncWithGitHub(): Promise<SyncResult> {
  return repoSync.sync();
}
