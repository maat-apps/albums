import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

beforeEach(async () => {
  await resetIndexedDb();
});

describe("useAlbums", () => {
  it("re-renders with the latest albums after a save", async () => {
    vi.resetModules();
    const { useAlbums } = await import("@/hooks/use-albums");
    const storage = await import("@/lib/storage");
    await storage.whenLoaded();
    const { result } = renderHook(() => useAlbums());

    act(() =>
      storage.saveAlbum({
        id: "a1",
        year: null,
        artist: "Artist",
        title: "Title",
        status: "toListen",
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
      }),
    );

    expect(result.current).toHaveLength(1);
  });
});

describe("useAlbum / useAlbumsReady", () => {
  it("finds an album and reports readiness once loaded", async () => {
    vi.resetModules();
    const { useAlbum, useAlbumsReady } = await import("@/hooks/use-albums");
    const storage = await import("@/lib/storage");
    const { result } = renderHook(() => ({
      album: useAlbum("a1"),
      ready: useAlbumsReady(),
    }));

    await act(() => storage.whenLoaded());
    expect(result.current.ready).toBe(true);
    expect(result.current.album).toBeUndefined();
    expect(storage.isAlbumsReadyOnServer()).toBe(false);

    act(() =>
      storage.saveAlbum({
        id: "a1",
        year: null,
        artist: "Artist",
        title: "Title",
        status: "toListen",
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
      }),
    );
    expect(result.current.album?.title).toBe("Title");
  });
});
