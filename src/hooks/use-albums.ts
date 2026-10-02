import { useSyncExternalStore } from "react";

import type { Album } from "../lib/schemas";
import {
  getAlbumsSnapshot,
  getServerAlbumsSnapshot,
  isAlbumsReady,
  isAlbumsReadyOnServer,
  subscribe,
} from "../lib/storage";

export function useAlbums(): Album[] {
  return useSyncExternalStore(
    subscribe,
    getAlbumsSnapshot,
    getServerAlbumsSnapshot,
  );
}

/** One album by id, or `undefined` (not found, or not loaded yet). */
export function useAlbum(id: string): Album | undefined {
  return useAlbums().find((album) => album.id === id);
}

/** Whether albums have loaded — see storage.ts's isAlbumsReady. */
export function useAlbumsReady(): boolean {
  return useSyncExternalStore(subscribe, isAlbumsReady, isAlbumsReadyOnServer);
}
