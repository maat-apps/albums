// vitest.config.ts's isolate: false shares one fake-indexeddb global across
// the whole run, so every test touching the storage layer needs to delete
// the database itself rather than getting a fresh fake IndexedDB per file.
export function resetIndexedDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("albums");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
