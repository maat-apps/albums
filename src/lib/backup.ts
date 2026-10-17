import {
  BackupError,
  createLocalBackup,
  type LocalBackup,
} from "@maat-apps/core/local";

import { clearCovers } from "./cover-store";
import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import type { Album } from "./schemas";
import { albumsStore, mergeIntoAlbums } from "./storage";
import { SNAPSHOT_KEY } from "./storage-keys";

// albums' backup and pre-update snapshot (@maat-apps/core/local): the albums
// as `data`, validated through the same schema as storage read-back.

export { BackupError };

export const BACKUP_VERSION = 1;

export type Backup = LocalBackup<{ albums: Album[] }>;

export const backups = createLocalBackup({
  app: "albums",
  version: BACKUP_VERSION,
  store: albumsStore,
  messages: {
    notJson: "The file is not valid JSON.",
    wrongApp: "The file is not an albums backup.",
  },
  // Covers of albums the backup doesn't have would otherwise linger.
  afterApply: () => void clearCovers(),
  snapshot: {
    storage: keyValueStore,
    key: SNAPSHOT_KEY,
    keyHolder: encryptionKey,
  },
});

export const createBackup = backups.create;

/** Validates a backup file's text; unrecognised albums are dropped. */
export const parseBackup = backups.parse;

/** Same validation for an already-parsed value (e.g. the update snapshot). */
export const parseBackupValue = backups.parseValue;

/**
 * Import from Settings: keeps the albums on the device and adds the
 * backup's, merged as a sync merges (`album-merge.ts`) — nothing deleted.
 */
export function mergeBackup(backup: Backup): void {
  mergeIntoAlbums(backup.data.albums);
}

/** Overwrites every album with the backup's — restoring the update snapshot. */
export const applyBackup = backups.apply;

export const backupFileName = backups.fileName;
export const downloadBackup = backups.download;

/** Offers the backup to the share sheet; "unavailable" means download it. */
export const shareBackup = backups.share;
