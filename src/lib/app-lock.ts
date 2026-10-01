import { createAppLock } from "@maat-apps/core/lock";

import { setLockEnrolment } from "./app-settings";
import { encryptionKey } from "./encryption-key";

// NEVER change this once the app has users: it's part of how their data is
// encrypted, so a different value makes every encrypted record unreadable.
export const HKDF_INFO = "albums-data-v1";

// Every maat-apps app has the app lock (@maat-apps/core/lock): a WebAuthn
// gate that encrypts the app's data when the authenticator supports PRF, a
// UI gate otherwise. `data` connects it to the app's storage — once the app
// keeps data, `rewrite` re-saves it with the current key and `erase` wipes
// it (plus any update snapshot), as routines' and trainer's app-lock.ts do.
export const appLock = createAppLock({
  name: "albums",
  keyInfo: HKDF_INFO,
  keyHolder: encryptionKey,
  saveEnrolment: setLockEnrolment,
  data: {
    rewrite: () => {},
    erase: () => {},
  },
});
