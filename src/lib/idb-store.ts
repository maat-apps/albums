import { createKeyValueStore } from "@maat-apps/core/storage";

// The key-value store every storage module builds on (@maat-apps/core's
// IndexedDB wrapper, one database per app). See maat-core's
// docs/storage.md for the in-memory + write-through pattern on top of it.

const store = createKeyValueStore({ name: "albums" });

export const kvGet = store.get;
export const kvSet = store.set;
export const kvDelete = store.delete;

export { store as keyValueStore };
