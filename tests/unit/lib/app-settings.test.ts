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

describe("collection prefs", () => {
  it("defaults to a grid sorted by artist, showing everything", async () => {
    const appSettings = await freshAppSettings();
    expect(appSettings.getSettingsSnapshot().collection).toEqual({
      viewMode: "grid",
      sortKey: "artist",
      sortDirection: "asc",
      statusFilters: [],
    });
  });

  it("merges changes", async () => {
    const appSettings = await freshAppSettings();

    appSettings.setCollectionPrefs({ viewMode: "list" });
    appSettings.setCollectionPrefs({ statusFilters: ["toListen"] });

    expect(appSettings.getSettingsSnapshot().collection).toMatchObject({
      viewMode: "list",
      statusFilters: ["toListen"],
    });
  });

  it("falls back per field for stored values it doesn't know", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, {
      collection: { viewMode: "list", sortKey: "rating", statusFilters: 3 },
    });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();

    expect(appSettings.getSettingsSnapshot().collection).toEqual({
      viewMode: "list",
      sortKey: "artist",
      sortDirection: "asc",
      statusFilters: [],
    });
  });

  it("opens on every status after a relaunch, keeping the rest", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, {
      collection: { viewMode: "list", statusFilters: ["toListen"] },
    });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();

    expect(appSettings.getSettingsSnapshot().collection).toMatchObject({
      viewMode: "list",
      statusFilters: [],
    });
  });
});

describe("streaming service", () => {
  it("defaults to Deezer, and remembers a change", async () => {
    const appSettings = await freshAppSettings();
    expect(appSettings.getSettingsSnapshot().streamingService).toBe("deezer");

    appSettings.setStreamingService("spotify");

    expect(appSettings.getSettingsSnapshot().streamingService).toBe("spotify");
  });

  it("reads a stored service, and an unknown one as Deezer", async () => {
    for (const [stored, read] of [
      ["appleMusic", "appleMusic"],
      ["tidal", "deezer"],
    ]) {
      vi.resetModules();
      await resetIndexedDb();
      const { kvSet } = await import("@/lib/idb-store");
      const { SETTINGS_KEY } = await import("@/lib/storage-keys");
      await kvSet(SETTINGS_KEY, { streamingService: stored });
      const appSettings = await freshAppSettings();
      await appSettings.whenLoaded();

      expect(appSettings.getSettingsSnapshot().streamingService).toBe(read);
    }
  });
});

describe("relockAfterMs", () => {
  it("defaults to 30 seconds", async () => {
    const appSettings = await freshAppSettings();
    expect(appSettings.relockAfterMs()).toBe(30_000);
  });

  it("follows the chosen setting", async () => {
    const appSettings = await freshAppSettings();
    appSettings.setRelockAfter("now");
    expect(appSettings.relockAfterMs()).toBe(0);
    appSettings.setRelockAfter("close");
    expect(appSettings.relockAfterMs()).toBeNull();
  });

  it("falls back to 30 seconds for an unknown stored choice", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, { relockAfter: "never" });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();
    expect(appSettings.getSettingsSnapshot().relockAfter).toBe("30s");
  });

  it("loads a stored choice", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { SETTINGS_KEY } = await import("@/lib/storage-keys");
    await kvSet(SETTINGS_KEY, { relockAfter: "now" });
    const appSettings = await freshAppSettings();
    await appSettings.whenLoaded();
    expect(appSettings.relockAfterMs()).toBe(0);
  });
});
