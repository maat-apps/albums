import { useEffect } from "react";

import { lookUpAlbumNow } from "../lib/cover-lookup-runner";
import { useAppSettings } from "./use-app-settings";

/**
 * Looks the album up in the background while it's on screen, filling a
 * missing cover, year or link to the user's streaming service
 * (cover-lookup-runner.ts). Leaving stops it; nothing half-found is saved.
 */
export function useAlbumLookup(id: string | undefined): void {
  const { streamingService } = useAppSettings();
  useEffect(() => {
    if (id === undefined) return;
    const controller = new AbortController();
    lookUpAlbumNow(id, streamingService, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [id, streamingService]);
}
