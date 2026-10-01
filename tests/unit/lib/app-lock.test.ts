import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// The lock's own behavior (enrol/verify/disable, PRF, the session state) is
// tested in @maat-apps/core/lock; these tests cover this app's wiring.

function fakeCredential(): PublicKeyCredential {
  return {
    rawId: new Uint8Array([1, 2, 3]).buffer,
    getClientExtensionResults: () => ({}),
  } as unknown as PublicKeyCredential;
}

async function freshModules() {
  vi.resetModules();
  const settings = await import("@/lib/app-settings");
  await settings.whenLoaded();
  const { appLock } = await import("@/lib/app-lock");
  return { settings, appLock };
}

beforeEach(async () => {
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appLock", () => {
  it("stores the enrolment in settings", async () => {
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue(fakeCredential()) },
    });
    const { settings, appLock } = await freshModules();

    const enrolment = await appLock.enrol();

    expect(settings.getSettingsSnapshot().lock).toEqual(enrolment);
  });

  it("clears the enrolment on disable", async () => {
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue(fakeCredential()) },
    });
    const { settings, appLock } = await freshModules();
    await appLock.enrol();

    appLock.disable();

    expect(settings.getSettingsSnapshot().lock).toBeNull();
  });

  it("clears the enrolment on disableAndErase", async () => {
    const { settings, appLock } = await freshModules();
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });

    await appLock.disableAndErase();

    expect(settings.getSettingsSnapshot().lock).toBeNull();
    expect(appLock.isSessionUnlocked()).toBe(true);
  });
});

describe("data wiring", () => {
  it("rewrites the albums unencrypted when the lock is turned off", async () => {
    const { appLock } = await freshModules();
    const storage = await import("@/lib/storage");
    await storage.whenLoaded();
    const { encryptionKey } = await import("@/lib/encryption-key");
    const { deriveKey, isEncryptedBlob, randomBytes } =
      await import("@maat-apps/core/crypto");
    const { kvGet } = await import("@/lib/idb-store");
    const { DATA_KEY } = await import("@/lib/storage-keys");
    encryptionKey.set(
      await deriveKey(randomBytes(32), randomBytes(16), "test-data-v1"),
    );
    storage.saveAlbum({
      id: "a1",
      year: null,
      artist: "Artist",
      title: "Secret",
      status: "toListen",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
    await vi.waitFor(async () =>
      expect(isEncryptedBlob(await kvGet(DATA_KEY))).toBe(true),
    );

    appLock.disable();

    await vi.waitFor(async () =>
      expect(await kvGet(DATA_KEY)).toMatchObject({
        albums: [{ title: "Secret" }],
      }),
    );
  });

  it("erases the albums and the update snapshot", async () => {
    const { appLock } = await freshModules();
    const storage = await import("@/lib/storage");
    await storage.whenLoaded();
    const appUpdate = await import("@/lib/app-update");
    storage.saveAlbum({
      id: "a1",
      year: null,
      artist: "Artist",
      title: "Gone",
      status: "toListen",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
    await appUpdate.saveUpdateSnapshot();

    await appLock.disableAndErase();

    expect(storage.getAlbumsSnapshot()).toEqual([]);
    expect(appUpdate.hasUpdateSnapshot()).toBe(false);
  });
});
