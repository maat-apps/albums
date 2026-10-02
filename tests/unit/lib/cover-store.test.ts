import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

const URL_A = "https://coverartarchive.org/release/a/front-250";
const URL_B = "https://coverartarchive.org/release/b/front-250";

// jsdom's Blob doesn't mix with Node's Response, so fetch resolves to the
// bits of a Response the store reads.
function response(blob: Blob, ok = true): Response {
  return { ok, blob: () => Promise.resolve(blob) } as Response;
}

function imageResponse(bytes = [1, 2, 3], type = "image/jpeg"): Response {
  return response(new Blob([new Uint8Array(bytes)], { type }));
}

async function fresh() {
  vi.resetModules();
  const covers = await import("@/lib/cover-store");
  const { kvGet, kvSet } = await import("@/lib/idb-store");
  const { encryptionKey } = await import("@/lib/encryption-key");
  const keys = await import("@/lib/storage-keys");
  return { covers, kvGet, kvSet, encryptionKey, keys };
}

async function bytes(blob: Blob | null): Promise<number[]> {
  expect(blob).not.toBeNull();
  return [...new Uint8Array(await blob!.arrayBuffer())];
}

async function testKey() {
  const { deriveKey, randomBytes } = await import("@maat-apps/core/crypto");
  return deriveKey(randomBytes(32), randomBytes(16), "test-data-v1");
}

beforeEach(async () => {
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCover", () => {
  it("returns null for an album without a cover", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { covers } = await fresh();

    expect(await covers.loadCover({ id: "a1" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches a cover once, then serves it from storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { covers, kvGet, keys } = await fresh();

    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([1, 2, 3]);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const again = await covers.loadCover({ id: "a1", coverUrl: URL_A });

    expect(await bytes(again)).toEqual([1, 2, 3]);
    expect(again?.type).toBe("image/jpeg");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(URL_A, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(await kvGet(keys.COVER_INDEX_KEY)).toEqual(["a1"]);
  });

  it("fetches again when the album's cover URL changed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imageResponse([1]))
      .mockResolvedValueOnce(imageResponse([2]));
    vi.stubGlobal("fetch", fetchMock);
    const { covers, kvGet, keys } = await fresh();

    await covers.loadCover({ id: "a1", coverUrl: URL_A });
    const changed = await covers.loadCover({ id: "a1", coverUrl: URL_B });

    expect(await bytes(changed)).toEqual([2]);
    expect(await kvGet(keys.COVER_INDEX_KEY)).toEqual(["a1"]);
  });

  it.each([
    ["a failed request", () => Promise.resolve(response(new Blob(), false))],
    ["a network or CORS error", () => Promise.reject(new TypeError("cors"))],
    [
      "a response that isn't an image",
      () => Promise.resolve(imageResponse([1], "text/html")),
    ],
  ])("returns null on %s, storing nothing", async (_, respond) => {
    vi.stubGlobal("fetch", vi.fn(respond));
    const { covers, kvGet, keys } = await fresh();

    expect(await covers.loadCover({ id: "a1", coverUrl: URL_A })).toBeNull();
    expect(await kvGet(keys.coverKey("a1"))).toBeUndefined();
  });

  it("shows but doesn't store a cover over the size limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse()));
    const { covers, kvGet, keys } = await fresh();
    const big = new Blob([new Uint8Array(covers.MAX_COVER_BYTES + 1)], {
      type: "image/png",
    });
    vi.mocked(fetch).mockResolvedValue(response(big));

    const blob = await covers.loadCover({ id: "a1", coverUrl: URL_A });

    expect(blob?.size).toBe(covers.MAX_COVER_BYTES + 1);
    expect(await kvGet(keys.coverKey("a1"))).toBeUndefined();
  });

  it("still returns the cover when storing it fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse()));
    const { covers } = await fresh();
    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "set").mockRejectedValueOnce(new Error("full"));

    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([1, 2, 3]);
  });

  it("refetches a stored entry that isn't a cover", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse([7])));
    const { covers, kvSet, keys } = await fresh();
    await kvSet(keys.coverKey("a1"), { url: URL_A });

    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([7]);
  });

  it("refetches when the stored read fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse([8])));
    const { covers } = await fresh();
    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "get").mockRejectedValueOnce(new Error("broken"));

    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([8]);
  });
});

describe("encryption", () => {
  it("stores covers encrypted while the lock has a key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { covers, kvGet, keys, encryptionKey } = await fresh();
    encryptionKey.set(await testKey());

    await covers.loadCover({ id: "a1", coverUrl: URL_A });
    const { isEncryptedBlob } = await import("@maat-apps/core/crypto");

    expect(isEncryptedBlob(await kvGet(keys.coverKey("a1")))).toBe(true);
    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refetches an encrypted cover it can't decrypt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imageResponse([1]))
      .mockResolvedValueOnce(imageResponse([2]))
      .mockResolvedValueOnce(imageResponse([3]));
    vi.stubGlobal("fetch", fetchMock);
    const { covers, encryptionKey } = await fresh();
    encryptionKey.set(await testKey());
    await covers.loadCover({ id: "a1", coverUrl: URL_A });

    encryptionKey.set(await testKey());
    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([2]);

    encryptionKey.set(null);
    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([3]);
  });

  it("refetches an encrypted entry that doesn't hold a cover", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse([9])));
    const { covers, kvSet, keys, encryptionKey } = await fresh();
    const key = await testKey();
    encryptionKey.set(key);
    const { encryptJson } = await import("@maat-apps/core/crypto");
    await kvSet(keys.coverKey("a1"), await encryptJson(key, { nope: true }));

    expect(
      await bytes(await covers.loadCover({ id: "a1", coverUrl: URL_A })),
    ).toEqual([9]);
  });
});

describe("deleteCover / clearCovers", () => {
  it("deletes one album's cover", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(imageResponse())),
    );
    const { covers, kvGet, keys } = await fresh();
    await covers.loadCover({ id: "a1", coverUrl: URL_A });
    await covers.loadCover({ id: "a2", coverUrl: URL_B });

    await covers.deleteCover("a1");

    expect(await kvGet(keys.coverKey("a1"))).toBeUndefined();
    expect(await kvGet(keys.coverKey("a2"))).toBeDefined();
    expect(await kvGet(keys.COVER_INDEX_KEY)).toEqual(["a2"]);
  });

  it("clears every cover, keeping track of covers loaded in parallel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(imageResponse())),
    );
    const { covers, kvGet, keys } = await fresh();
    await Promise.all(
      ["a1", "a2", "a3"].map((id) => covers.loadCover({ id, coverUrl: URL_A })),
    );
    expect(await kvGet(keys.COVER_INDEX_KEY)).toHaveLength(3);

    await covers.clearCovers();

    for (const id of ["a1", "a2", "a3"]) {
      expect(await kvGet(keys.coverKey(id))).toBeUndefined();
    }
    expect(await kvGet(keys.COVER_INDEX_KEY)).toEqual([]);
  });

  it("keeps updating the index after a failed update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(imageResponse())),
    );
    const { covers, kvGet, keys } = await fresh();
    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "get").mockRejectedValueOnce(new Error("broken"));

    await expect(covers.clearCovers()).rejects.toThrow("broken");
    await covers.loadCover({ id: "a1", coverUrl: URL_A });

    expect(await kvGet(keys.COVER_INDEX_KEY)).toEqual(["a1"]);
  });
});
