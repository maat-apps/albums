// Every IndexedDB key this app owns is declared here — add new ones here so
// storage, backup and reset logic stay in step.
export const SETTINGS_KEY = "albums-settings";
export const LOCALE_KEY = "albums-locale";
export const DATA_KEY = "albums-data";
export const SNAPSHOT_KEY = "albums-update-snapshot";
export const COVER_INDEX_KEY = "albums-cover-index";

/** One stored cover per album (see cover-store.ts). */
export function coverKey(albumId: string): string {
  return `albums-cover:${albumId}`;
}
