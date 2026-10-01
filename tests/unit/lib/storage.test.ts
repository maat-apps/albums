import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Album } from "@/lib/schemas";
import { resetIndexedDb } from "../reset-indexeddb";

const NOW = new Date("2026-10-01T10:00:00.000Z");

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "a1",
    year: 1977,
    artist: "Artist",
    title: "Title",
    status: "toListen",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

// storage.ts keeps module-level state, so every test gets a fresh module
// graph (and with it a fresh key holder and settings store).
async function freshStorage() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  return storage;
}

async function stored(): Promise<unknown> {
  const { kvGet } = await import("@/lib/idb-store");
  const { DATA_KEY } = await import("@/lib/storage-keys");
  return kvGet(DATA_KEY);
}

async function testKey() {
  const { deriveKey, randomBytes } = await import("@maat-apps/core/crypto");
  return deriveKey(randomBytes(32), randomBytes(16), "test-data-v1");
}

beforeEach(async () => {
  await resetIndexedDb();
});

describe("saveAlbum / setStatus / deleteAlbum", () => {
  it("adds an album and stamps updatedAt", async () => {
    const storage = await freshStorage();
    const later = new Date("2026-10-02T00:00:00.000Z");

    storage.saveAlbum(album(), later);

    expect(storage.getAlbumsSnapshot()).toEqual([
      album({ updatedAt: later.toISOString() }),
    ]);
  });

  it("only touches the album being saved", async () => {
    const storage = await freshStorage();
    storage.saveAlbum(album({ id: "a" }), NOW);
    storage.saveAlbum(album({ id: "b" }), NOW);

    storage.saveAlbum(album({ id: "a", title: "Renamed" }), NOW);

    expect(storage.getAlbumsSnapshot()).toEqual([
      album({ id: "a", title: "Renamed" }),
      album({ id: "b" }),
    ]);
  });

  it("changes the status of a known album only", async () => {
    const storage = await freshStorage();
    storage.saveAlbum(album(), NOW);

    storage.setStatus("missing", "comingBack", NOW);
    storage.setStatus("a1", "comingBack", NOW);

    expect(storage.getAlbumsSnapshot()).toEqual([
      album({ status: "comingBack" }),
    ]);
  });

  it("deletes by id and ignores unknown ids", async () => {
    const storage = await freshStorage();
    storage.saveAlbum(album());
    const listener = vi.fn();
    const unsubscribe = storage.subscribe(listener);

    storage.deleteAlbum("missing");
    storage.deleteAlbum("a1");
    unsubscribe();

    expect(storage.getAlbumsSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("addAlbums", () => {
  it("appends in one write and ignores an empty batch", async () => {
    const storage = await freshStorage();
    const listener = vi.fn();
    storage.subscribe(listener);

    storage.addAlbums([]);
    storage.addAlbums([album({ id: "a" }), album({ id: "b" })]);

    expect(storage.getAlbumsSnapshot()).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("loading", () => {
  it("persists to IndexedDB for the next session", async () => {
    const storage = await freshStorage();
    storage.saveAlbum(album());
    await vi.waitFor(async () => expect(await stored()).toBeTruthy());

    const next = await freshStorage();

    expect(next.getAlbumsSnapshot()).toHaveLength(1);
  });

  it("ignores a stored value that isn't an object", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    const { DATA_KEY } = await import("@/lib/storage-keys");
    await kvSet(DATA_KEY, "garbage");

    const storage = await freshStorage();

    expect(storage.getAlbumsSnapshot()).toEqual([]);
  });

  it("starts empty when the read fails", async () => {
    vi.resetModules();
    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "get").mockRejectedValueOnce(new Error("disk"));
    const storage = await import("@/lib/storage");
    await storage.whenLoaded();

    expect(storage.getAlbumsSnapshot()).toEqual([]);
  });

  it("keeps working in memory when a write fails", async () => {
    const storage = await freshStorage();
    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "set").mockRejectedValueOnce(new Error("full"));

    storage.saveAlbum(album());

    expect(storage.getAlbumsSnapshot()).toHaveLength(1);
  });

  it("serves an empty list on the server", async () => {
    const storage = await freshStorage();
    expect(storage.getServerAlbumsSnapshot()).toEqual([]);
  });
});

describe("encryption", () => {
  it("writes an encrypted blob while a key is set", async () => {
    const storage = await freshStorage();
    const { encryptionKey } = await import("@/lib/encryption-key");
    const { isEncryptedBlob } = await import("@maat-apps/core/crypto");
    encryptionKey.set(await testKey());

    storage.saveAlbum(album());

    await vi.waitFor(async () =>
      expect(isEncryptedBlob(await stored())).toBe(true),
    );
  });

  it("holds the first read until the key is set when the lock encrypts", async () => {
    vi.resetModules();
    const settings = await import("@/lib/app-settings");
    await settings.whenLoaded();
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });
    const key = await testKey();
    const { encryptJson } = await import("@maat-apps/core/crypto");
    const { kvSet } = await import("@/lib/idb-store");
    const { DATA_KEY } = await import("@/lib/storage-keys");
    await kvSet(DATA_KEY, await encryptJson(key, { albums: [album()] }));

    const storage = await import("@/lib/storage");
    void storage.whenLoaded();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(storage.getAlbumsSnapshot()).toEqual([]);

    const { encryptionKey } = await import("@/lib/encryption-key");
    encryptionKey.set(key);
    await storage.whenLoaded();
    expect(storage.getAlbumsSnapshot()).toEqual([album()]);
  });
});
