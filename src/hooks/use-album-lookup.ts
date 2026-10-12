import { useEffect } from "react";

import { lookUpAlbumNow } from "../lib/cover-lookup-runner";

/**
 * Looks the album up in the background while it's on screen, filling a
 * missing cover, Deezer link or year (cover-lookup-runner.ts). Leaving
 * stops it; nothing half-found is saved.
 */
export function useAlbumLookup(id: string | undefined): void {
  useEffect(() => {
    if (id === undefined) return;
    const controller = new AbortController();
    lookUpAlbumNow(id, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [id]);
}
