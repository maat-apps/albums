import { useSyncExternalStore } from "react";

import {
  isConnected,
  isConnectedOnServer,
  subscribe,
} from "../lib/spotify-session";

/** Whether Spotify is connected (spotify-session.ts). */
export function useSpotifyConnected(): boolean {
  return useSyncExternalStore(subscribe, isConnected, isConnectedOnServer);
}
