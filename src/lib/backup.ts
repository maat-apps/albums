import {
  BackupError,
  backupFileName as coreBackupFileName,
  downloadBackup as coreDownloadBackup,
  shareBackup as coreShareBackup,
  readBackupEnvelope,
  readBackupJson,
} from "@maat-apps/core/backup";
import { isRecord } from "@maat-apps/core/validation";

import { parseAlbums, type Album } from "./schemas";
import { getAlbumsSnapshot, replaceAllAlbums } from "./storage";

// albums' backup format on top of @maat-apps/core/backup, which handles the
// envelope checks, the backup file and the download.

export { BackupError };

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "albums";
  version: number;
  exportedAt: string;
  data: { albums: Album[] };
};

const messages = {
  notJson: "The file is not valid JSON.",
  wrongApp: "The file is not an albums backup.",
};

export function createBackup(): Backup {
  return {
    app: "albums",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { albums: getAlbumsSnapshot() },
  };
}

/** Validates a backup file's text; unrecognised albums are dropped. */
export function parseBackup(text: string): Backup {
  return parseBackupValue(readBackupJson(text, messages));
}

/** Same validation for an already-parsed value (e.g. the update snapshot). */
export function parseBackupValue(parsed: unknown): Backup {
  const envelope = readBackupEnvelope(parsed, { app: "albums", messages });
  const data = isRecord(envelope.data) ? envelope.data : {};
  return {
    app: "albums",
    version: BACKUP_VERSION,
    exportedAt: envelope.exportedAt,
    data: { albums: parseAlbums(data.albums) },
  };
}

/** Overwrites every album with the backup's. */
export function applyBackup(backup: Backup): void {
  replaceAllAlbums(backup.data.albums);
}

export function backupFileName(date = new Date()): string {
  return coreBackupFileName("albums", date);
}

export function downloadBackup(backup: Backup = createBackup()): void {
  coreDownloadBackup(backup);
}

/** Offers the backup to the share sheet; "unavailable" means download it. */
export function shareBackup(backup: Backup = createBackup()) {
  return coreShareBackup(backup);
}
