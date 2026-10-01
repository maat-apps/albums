import { afterEach, describe, expect, it, vi } from "vitest";

import { updateApp } from "@/lib/app-update";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateApp", () => {
  it("reloads the page", async () => {
    // jsdom's window.location.reload isn't configurable, so it can't be
    // spied on directly — vi.stubGlobal replaces the whole object instead,
    // and (unlike a raw Object.defineProperty) restores it safely even when
    // the environment is reused across files (isolate: false).
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("updates a waiting service worker registration", async () => {
    // jsdom has no ServiceWorkerContainer at all, so "serviceWorker" in
    // navigator is normally false and this branch is never exercised —
    // stub navigator wholesale rather than trying to patch a container that
    // doesn't exist.
    const update = vi.fn().mockResolvedValue(undefined);
    const postMessage = vi.fn();
    const getRegistration = vi.fn().mockResolvedValue({
      update,
      waiting: { postMessage },
    });
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
    vi.stubGlobal("location", { reload: vi.fn() });

    await updateApp();

    expect(update).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("still reloads if the service worker check throws", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn().mockRejectedValue(new Error("nope")),
      },
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears every cache", async () => {
    // jsdom has no Cache Storage API either, so "caches" in window is
    // normally false — same reasoning as the service worker case above.
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["cache-a", "cache-b"]),
      delete: deleteCache,
    });
    vi.stubGlobal("location", { reload: vi.fn() });

    await updateApp();

    expect(deleteCache).toHaveBeenCalledWith("cache-a");
    expect(deleteCache).toHaveBeenCalledWith("cache-b");
    expect(deleteCache).toHaveBeenCalledTimes(2);
  });

  it("still reloads if clearing caches throws", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn().mockRejectedValue(new Error("nope")),
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
