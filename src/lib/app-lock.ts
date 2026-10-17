import { lockData } from "@maat-apps/core/local";
import { createAppLock } from "@maat-apps/core/lock";

import { relockAfterMs, setLockEnrolment } from "./app-settings";
import { backups } from "./backup";
import { clearCovers } from "./cover-store";
import { encryptionKey } from "./encryption-key";
import { githubConnection } from "./github-sync";
import { albumsStore } from "./storage";

// NEVER change this once the app has users: it's part of how their data is
// encrypted, so a different value makes every encrypted record unreadable.
export const HKDF_INFO = "albums-data-v1";

// The app lock (@maat-apps/core/lock): a WebAuthn gate that encrypts the
// albums and the update snapshot when the authenticator supports PRF, a UI
// gate otherwise.
export const appLock = createAppLock({
  name: "Albums",
  keyInfo: HKDF_INFO,
  keyHolder: encryptionKey,
  relockAfterMs,
  saveEnrolment: setLockEnrolment,
  data: lockData(
    albumsStore,
    backups.lockPart,
    // Stored covers are a cache: rather than re-encrypting each one, drop
    // them and let them load again under the new key.
    { rewrite: clearCovers, erase: clearCovers },
    // The GitHub token is only kept encrypted: deleted when the lock stops
    // encrypting, re-encrypted under a new key.
    githubConnection,
  ),
});
