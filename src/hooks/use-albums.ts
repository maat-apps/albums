import { useSyncExternalStore } from "react";

import type { Album } from "../lib/schemas";
import {
  getAlbumsSnapshot,
  getServerAlbumsSnapshot,
  subscribe,
} from "../lib/storage";

export function useAlbums(): Album[] {
  return useSyncExternalStore(
    subscribe,
    getAlbumsSnapshot,
    getServerAlbumsSnapshot,
  );
}
