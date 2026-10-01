import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// app-settings.ts caches state in a module-level singleton, so each test
// needs a fresh module instance to control what it reads/writes.
async function freshAppSettings() {
  vi.resetModules();
  return import("@/lib/app-settings");
}

beforeEach(async () => {
  await resetIndexedDb();
});

describe("getSettingsSnapshot / getServerSettingsSnapshot", () => {
  it("defaults to not installed", async () => {
    const appSettings = await freshAppSettings();
    expect(appSettings.getSettingsSnapshot().installed).toBe(false);
    expect(appSettings.getServerSettingsSnapshot().installed).toBe(false);
  });

  it("loads a previously persisted flag", async () => {
    // resetModules before this seed write (not just inside
    // freshAppSettings() below) — idb-store.ts caches its DB connection at
    // module scope, and reusing a connection opened before this test's
    // beforeEach deleted the database throws InvalidStateError.
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, { installed: true });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();
    expect(appSettings.getSettingsSnapshot().installed).toBe(true);
  });

  it("ignores a stored value with a non-boolean flag", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, { installed: "yes" });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();
    expect(appSettings.getSettingsSnapshot().installed).toBe(false);
  });
});

describe("markInstalled", () => {
  it("sets the installed flag and notifies listeners", async () => {
    const appSettings = await freshAppSettings();
    const listener = vi.fn();
    appSettings.subscribeToSettings(listener);

    appSettings.markInstalled();

    expect(appSettings.getSettingsSnapshot().installed).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is a no-op once already installed", async () => {
    const appSettings = await freshAppSettings();
    appSettings.markInstalled();
    const listener = vi.fn();
    appSettings.subscribeToSettings(listener);

    appSettings.markInstalled();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("subscribeToSettings", () => {
  it("stops notifying after unsubscribing", async () => {
    const appSettings = await freshAppSettings();
    const listener = vi.fn();
    const unsubscribe = appSettings.subscribeToSettings(listener);
    unsubscribe();

    appSettings.markInstalled();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("setLockEnrolment", () => {
  const enrolment = {
    credentialId: "c1",
    userId: "u1",
    createdAt: "now",
    encryptionSupported: false,
  };

  it("stores and clears the lock", async () => {
    const appSettings = await freshAppSettings();

    appSettings.setLockEnrolment(enrolment);
    expect(appSettings.getSettingsSnapshot().lock).toEqual(enrolment);

    appSettings.setLockEnrolment(null);
    expect(appSettings.getSettingsSnapshot().lock).toBeNull();
  });

  it("reads a corrupt stored lock as no lock", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, { installed: true, lock: { userId: "u1" } });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();

    expect(appSettings.getSettingsSnapshot().lock).toBeNull();
    expect(appSettings.getSettingsSnapshot().installed).toBe(true);
  });

  it("is not ready on the server", async () => {
    const appSettings = await freshAppSettings();
    expect(appSettings.isSettingsReadyOnServer()).toBe(false);
  });
});
