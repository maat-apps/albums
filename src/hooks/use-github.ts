import { useSyncExternalStore } from "react";

import {
  getGitHubConnection,
  getServerGitHubConnection,
  subscribeToGitHub,
  type GitHubConnection,
} from "../lib/github-sync";

export function useGitHubConnection(): GitHubConnection | null {
  return useSyncExternalStore(
    subscribeToGitHub,
    getGitHubConnection,
    getServerGitHubConnection,
  );
}
