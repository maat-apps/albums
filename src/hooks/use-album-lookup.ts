import { useEffect, useState } from "react";

import { albumNeedsLookup, lookUpAlbumNow } from "../lib/cover-lookup-runner";
import type { Album } from "../lib/schemas";
import { useAppSettings } from "./use-app-settings";

/**
 * Looks the album up in the background while it's on screen, filling a
 * missing cover, year or link to the user's streaming service
 * (cover-lookup-runner.ts). Leaving stops it; nothing half-found is saved.
 * Returns whether that lookup is still under way, for loading skeletons.
 */
export function useAlbumLookup(album: Album | undefined): boolean {
  const { streamingService } = useAppSettings();
  const id = album?.id;
  // The run (album and service) that has finished, found something or not.
  const [settled, setSettled] = useState<string>();

  useEffect(() => {
    if (id === undefined) return;
    const controller = new AbortController();
    lookUpAlbumNow(id, streamingService, controller.signal)
      .catch(() => {})
      .then(() => {
        if (!controller.signal.aborted) setSettled(`${id}|${streamingService}`);
      });
    return () => controller.abort();
  }, [id, streamingService]);

  return (
    album !== undefined &&
    settled !== `${album.id}|${streamingService}` &&
    albumNeedsLookup(album, streamingService)
  );
}
