import {
  DEFAULT_RELOCK_AFTER_MS,
  parseLockEnrolment,
  type LockEnrolment,
} from "@maat-apps/core/lock";
import { createPersistedStore } from "@maat-apps/core/persisted";

import type { SortDirection, SortKey } from "./album-utils";
import { keyValueStore } from "./idb-store";
import type { AlbumStatus } from "./schemas";
import { SETTINGS_KEY } from "./storage-keys";
import { STREAMING_SERVICES, type StreamingService } from "./streaming";

// Settings that aren't part of the app's data (or a backup): the app lock's
// enrolment and browser/install state. @maat-apps/core/persisted keeps them
// in memory, backed by IndexedDB.
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

/** Right away, after 30 seconds in the background, or only once closed. */
export const RELOCK_CHOICES = ["now", "30s", "close"] as const;
export type RelockAfter = (typeof RELOCK_CHOICES)[number];

const RELOCK_AFTER_MS: Record<RelockAfter, number | null> = {
  now: 0,
  "30s": DEFAULT_RELOCK_AFTER_MS,
  close: null,
};

export type AppSettings = {
  /** The app lock's enrolment (@maat-apps/core/lock), `null` when off. */
  lock: LockEnrolment | null;
  /** How soon the lock comes back once the app is left. */
  relockAfter: RelockAfter;
  installed: boolean;
  collection: CollectionPrefs;
  /** Where "Open in …" leads, and whose links lookups fill in. */
  streamingService: StreamingService;
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

const settingsStore = createPersistedStore<AppSettings>({
  storage: keyValueStore,
  key: SETTINGS_KEY,
  defaults: {
    lock: null,
    relockAfter: "30s",
    installed: false,
    collection: DEFAULT_COLLECTION,
    streamingService: "deezer",
  },
  parse: (stored) => {
    const value = stored as Record<string, unknown>;
    return {
      lock: parseLockEnrolment(value.lock),
      relockAfter:
        RELOCK_CHOICES.find((choice) => choice === value.relockAfter) ?? "30s",
      installed: value.installed === true,
      collection: parseCollection(value.collection),
      streamingService: pick(
        value.streamingService,
        STREAMING_SERVICES,
        "deezer",
      ),
    };
  },
});

/** Test-only: resolves once the initial background read has finished. */
export const whenLoaded = settingsStore.whenLoaded;
export const subscribeToSettings = settingsStore.subscribe;
export const getSettingsSnapshot = settingsStore.getSnapshot;
export const getServerSettingsSnapshot = settingsStore.getServerSnapshot;
// The lock gate must not treat "not loaded yet" as "no lock enrolled", or a
// locked device would flash its data on every cold start.
export const subscribeToSettingsReady = settingsStore.subscribeReady;
export const isSettingsReady = settingsStore.isReady;

export function isSettingsReadyOnServer(): boolean {
  return false;
}

export function setLockEnrolment(lock: LockEnrolment | null): void {
  settingsStore.set({ lock });
}

/** Chrome stops offering the install prompt once installed, even to a plain
 * browser tab — this flag is the only record of it. */
export function setRelockAfter(relockAfter: RelockAfter): void {
  settingsStore.set({ relockAfter });
}

/** The lock's `relockAfterMs`: read on every hide, so a change applies at once. */
export function relockAfterMs(): number | null {
  return RELOCK_AFTER_MS[getSettingsSnapshot().relockAfter];
}

export function markInstalled(): void {
  if (getSettingsSnapshot().installed) return;
  settingsStore.set({ installed: true });
}

export function setCollectionPrefs(changes: Partial<CollectionPrefs>): void {
  settingsStore.set({
    collection: { ...getSettingsSnapshot().collection, ...changes },
  });
}

export function setStreamingService(streamingService: StreamingService): void {
  settingsStore.set({ streamingService });
}
