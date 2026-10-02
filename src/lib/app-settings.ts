import { parseLockEnrolment, type LockEnrolment } from "@maat-apps/core/lock";
import { createPersistedStore } from "@maat-apps/core/persisted";

import type { SortDirection, SortKey, StatusFilter } from "./album-utils";
import { keyValueStore } from "./idb-store";
import { ALBUM_STATUSES } from "./schemas";
import { SETTINGS_KEY } from "./storage-keys";

// Settings that aren't part of the app's data (or a backup): the app lock's
// enrolment and browser/install state. @maat-apps/core/persisted keeps them
// in memory, backed by IndexedDB.
export type ViewMode = "grid" | "list";

/** How the collection is shown — remembered across launches (PRODUCT.md). */
export type CollectionPrefs = {
  viewMode: ViewMode;
  sortKey: SortKey;
  sortDirection: SortDirection;
  statusFilter: StatusFilter;
};

export type AppSettings = {
  /** The app lock's enrolment (@maat-apps/core/lock), `null` when off. */
  lock: LockEnrolment | null;
  installed: boolean;
  collection: CollectionPrefs;
};

const DEFAULT_COLLECTION: CollectionPrefs = {
  viewMode: "grid",
  sortKey: "artist",
  sortDirection: "asc",
  statusFilter: "all",
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
    statusFilter: pick(stored.statusFilter, ["all", ...ALBUM_STATUSES], "all"),
  };
}

const settingsStore = createPersistedStore<AppSettings>({
  storage: keyValueStore,
  key: SETTINGS_KEY,
  defaults: { lock: null, installed: false, collection: DEFAULT_COLLECTION },
  parse: (stored) => {
    const value = stored as Record<string, unknown>;
    return {
      lock: parseLockEnrolment(value.lock),
      installed: value.installed === true,
      collection: parseCollection(value.collection),
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
export function markInstalled(): void {
  if (getSettingsSnapshot().installed) return;
  settingsStore.set({ installed: true });
}

export function setCollectionPrefs(changes: Partial<CollectionPrefs>): void {
  settingsStore.set({
    collection: { ...getSettingsSnapshot().collection, ...changes },
  });
}
