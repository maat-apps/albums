import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// idb-store.ts caches its connection at module scope, so each test uses a
// fresh module instance (the database itself is deleted in beforeEach).
async function freshIdbStore() {
  vi.resetModules();
  return import("@/lib/idb-store");
}

beforeEach(async () => {
  await resetIndexedDb();
});

describe("kvGet / kvSet / kvDelete", () => {
  it("returns undefined for a missing key", async () => {
    const { kvGet } = await freshIdbStore();
    await expect(kvGet("missing")).resolves.toBeUndefined();
  });

  it("round-trips, overwrites and deletes a value", async () => {
    const { kvGet, kvSet, kvDelete } = await freshIdbStore();
    await kvSet("k", { a: 1 });
    await expect(kvGet("k")).resolves.toEqual({ a: 1 });
    await kvSet("k", "second");
    await expect(kvGet("k")).resolves.toBe("second");
    await kvDelete("k");
    await expect(kvGet("k")).resolves.toBeUndefined();
  });
});
