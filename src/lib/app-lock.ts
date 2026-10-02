import { createAppLock } from "@maat-apps/core/lock";

import { setLockEnrolment } from "./app-settings";
import { discardUpdateSnapshot } from "./app-update";
import { clearCovers } from "./cover-store";
import { encryptionKey } from "./encryption-key";
import { disconnect, rewriteSpotifyToken } from "./spotify-session";
import { getAlbumsSnapshot, replaceAllAlbums } from "./storage";

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
  saveEnrolment: setLockEnrolment,
  data: {
    rewrite: () => {
      replaceAllAlbums(getAlbumsSnapshot());
      // Stored covers are a cache: rather than re-encrypting each one, drop
      // them and let them load again under the new key.
      void clearCovers();
      void rewriteSpotifyToken();
    },
    erase: async () => {
      replaceAllAlbums([]);
      await Promise.all([discardUpdateSnapshot(), clearCovers(), disconnect()]);
    },
  },
});
