import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no IndexedDB implementation, so every test file relying on the
// storage layer (src/lib/idb-store.ts, app-settings.ts, ...) needs it faked
// globally rather than per-file.
import "fake-indexeddb/auto";

afterEach(async () => {
  // @testing-library/react only registers its own cleanup when it finds a
  // *global* afterEach, which never happens without `test.globals` — so
  // renderHook()/render() components would stay mounted, their window
  // listeners outliving the test (see maat-core/docs/testing-unit.md).
  cleanup();
  // Storage writes are fire-and-forget, on purpose, for UI responsiveness.
  // A trailing macrotask delay lets this test's last writes settle before
  // the next test's beforeEach deletes the database out from under them. A
  // first-ever open also runs onupgradeneeded, so setTimeout(0) isn't enough.
  await new Promise((resolve) => setTimeout(resolve, 20));
});
