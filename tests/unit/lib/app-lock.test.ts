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
