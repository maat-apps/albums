import { createAppSettings } from "@maat-apps/core/app-settings";

import type { SortDirection, SortKey } from "./album-utils";
import { keyValueStore } from "./idb-store";
import type { AlbumStatus } from "./schemas";
import { SETTINGS_KEY } from "./storage-keys";
import { STREAMING_SERVICES, type StreamingService } from "./streaming";

// Settings that aren't part of the app's data (or a backup):
// @maat-apps/core/app-settings' lock enrolment, relock choice and installed
// flag, plus how the collection is shown and the streaming service.
export type ViewMode = "grid" | "list";

/** How the collection is shown — remembered across launches (PRODUCT.md),
 * except the status filters, which start empty (everything) on every launch. */
export type CollectionPrefs = {
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDirection: SortDirection;
  /** The statuses shown; none chosen shows every album. */
  statusFilters: AlbumStatus[];
};

const DEFAULT_COLLECTION: CollectionPrefs = {
  viewMode: "grid",
  sortKey: "artist",
  sortDirection: "asc",
  statusFilters: [],
};

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function parseCollection(value: unknown): CollectionPrefs {
  const stored = (value ?? {}) as Record<string, unknown>;
  return {
    viewMode: pick(stored.viewMode, ["grid", "list"], "grid"),
    sortKey: pick(stored.sortKey, ["year", "title", "artist"], "artist"),
    sortDirection: pick(stored.sortDirection, ["asc", "desc"], "asc"),
    // Every launch opens on the whole collection; the filters last only
    // until the app is closed.
    statusFilters: [],
  };
}

export const appSettings = createAppSettings({
  storage: keyValueStore,
  key: SETTINGS_KEY,
  extra: {
    defaults: {
      collection: DEFAULT_COLLECTION,
      /** Where "Open in …" leads, and whose links lookups fill in. */
      streamingService: "deezer" as StreamingService,
    },
    parse: (stored) => ({
      collection: parseCollection(stored.collection),
      streamingService: pick(
        stored.streamingService,
        STREAMING_SERVICES,
        "deezer",
      ),
    }),
  },
});

export type AppSettings = ReturnType<typeof appSettings.getSnapshot>;

/** Test-only: resolves once the initial background read has finished. */
export const whenLoaded = appSettings.whenLoaded;
export const subscribeToSettings = appSettings.subscribe;
export const getSettingsSnapshot = appSettings.getSnapshot;
export const getServerSettingsSnapshot = appSettings.getServerSnapshot;
// The lock gate must not treat "not loaded yet" as "no lock enrolled", or a
// locked device would flash its data on every cold start.
export const subscribeToSettingsReady = appSettings.subscribeReady;
export const isSettingsReady = appSettings.isReady;
export const isSettingsReadyOnServer = appSettings.isReadyOnServer;
export const setLockEnrolment = appSettings.setLockEnrolment;
export const setRelockAfter = appSettings.setRelockAfter;
export const relockAfterMs = appSettings.relockAfterMs;
export const markInstalled = appSettings.markInstalled;

export function setCollectionPrefs(changes: Partial<CollectionPrefs>): void {
  appSettings.set({
    collection: { ...getSettingsSnapshot().collection, ...changes },
  });
}

export function setStreamingService(streamingService: StreamingService): void {
  appSettings.set({ streamingService });
}
