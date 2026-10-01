import {
  createUpdateSnapshot,
  updateApp as updateAppWith,
} from "@maat-apps/core/update";

import {
  applyBackup,
  createBackup,
  parseBackupValue,
  type Backup,
} from "./backup";
import { encryptionKey } from "./encryption-key";
import { keyValueStore } from "./idb-store";
import { SNAPSHOT_KEY } from "./storage-keys";

// Settings' "Update app" and its pre-update snapshot (@maat-apps/core/update):
// the albums backup, encrypted with the lock's key like the albums themselves.

const snapshot = createUpdateSnapshot<Backup>({
  storage: keyValueStore,
  key: SNAPSHOT_KEY,
  backup: {
    create: createBackup,
    parse: parseBackupValue,
    apply: applyBackup,
  },
  encryption: { getKey: encryptionKey.get },
});

/** Test-only: resolves once the initial existence check has finished. */
export const whenLoaded = snapshot.whenLoaded;
export const subscribeToUpdateSnapshot = snapshot.subscribe;
export const hasUpdateSnapshot = snapshot.has;
export const hasNoUpdateSnapshotOnServer = snapshot.hasOnServer;
export const saveUpdateSnapshot = snapshot.save;
export const readUpdateSnapshot = snapshot.read;
export const restoreUpdateSnapshot = snapshot.restore;
export const discardUpdateSnapshot = snapshot.discard;

/** Snapshot, activate the waiting worker, drop every cache, reload. */
export function updateApp(): Promise<void> {
  return updateAppWith(snapshot);
}
