import { useSyncExternalStore } from "react";

import {
  getGitHubConnection,
  getGitHubSyncStatus,
  getServerGitHubConnection,
  getServerGitHubSyncStatus,
  subscribeToGitHub,
  subscribeToGitHubSync,
  type GitHubConnection,
  type GitHubSyncStatus,
} from "../lib/github-sync";

export function useGitHubConnection(): GitHubConnection | null {
  return useSyncExternalStore(
    subscribeToGitHub,
    getGitHubConnection,
    getServerGitHubConnection,
  );
}

/** Whether a sync (by hand or automatic) is running, and the last failure. */
export function useGitHubSyncStatus(): GitHubSyncStatus {
  return useSyncExternalStore(
    subscribeToGitHubSync,
    getGitHubSyncStatus,
    getServerGitHubSyncStatus,
  );
}
