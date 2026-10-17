import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Album } from "@/lib/schemas";

const lookUpAlbumNow = vi.fn();
const albumNeedsLookup = vi.fn(() => true);

const ALBUM: Album = {
  id: "a1",
  year: 1999,
  artist: "Zeta Band",
  title: "Made-up Title",
  status: "toListen",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

async function load() {
  vi.resetModules();
  vi.doMock("@/lib/cover-lookup-runner", () => ({
    lookUpAlbumNow,
    albumNeedsLookup,
  }));
  return (await import("@/hooks/use-album-lookup")).useAlbumLookup;
}

afterEach(() => {
  vi.doUnmock("@/lib/cover-lookup-runner");
  lookUpAlbumNow.mockReset();
  albumNeedsLookup.mockReset().mockReturnValue(true);
});

describe("useAlbumLookup", () => {
  it("looks the album up while mounted and stops on unmount", async () => {
    lookUpAlbumNow.mockReturnValue(new Promise(() => {}));
    const useAlbumLookup = await load();

    const { result, unmount } = renderHook(() => useAlbumLookup(ALBUM));

    expect(result.current).toBe(true);
    const [id, service, signal] = lookUpAlbumNow.mock.calls[0] as [
      string,
      string,
      AbortSignal,
    ];
    expect(id).toBe("a1");
    expect(service).toBe("deezer");
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("stops reporting a search once it has settled, even failed", async () => {
    let fail: (error: Error) => void = () => {};
    lookUpAlbumNow.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const useAlbumLookup = await load();
    const { result } = renderHook(() => useAlbumLookup(ALBUM));
    expect(result.current).toBe(true);

    await act(async () => fail(new Error("offline")));

    expect(result.current).toBe(false);
  });

  it("waits for the album, and reports nothing left to find", async () => {
    lookUpAlbumNow.mockResolvedValue(undefined);
    albumNeedsLookup.mockReturnValue(false);
    const useAlbumLookup = await load();

    const { result, rerender } = renderHook(
      ({ album }) => useAlbumLookup(album),
      { initialProps: { album: undefined as Album | undefined } },
    );
    expect(lookUpAlbumNow).not.toHaveBeenCalled();
    expect(result.current).toBe(false);

    rerender({ album: ALBUM });
    expect(lookUpAlbumNow).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });
});
