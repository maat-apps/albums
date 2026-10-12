import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const lookUpAlbumNow = vi.fn();

async function load() {
  vi.resetModules();
  vi.doMock("@/lib/cover-lookup-runner", () => ({ lookUpAlbumNow }));
  return (await import("@/hooks/use-album-lookup")).useAlbumLookup;
}

afterEach(() => {
  vi.doUnmock("@/lib/cover-lookup-runner");
  lookUpAlbumNow.mockReset();
});

describe("useAlbumLookup", () => {
  it("looks the album up while mounted and stops on unmount", async () => {
    lookUpAlbumNow.mockResolvedValue(undefined);
    const useAlbumLookup = await load();

    const { unmount } = renderHook(() => useAlbumLookup("a1"));

    expect(lookUpAlbumNow).toHaveBeenCalledOnce();
    const [id, signal] = lookUpAlbumNow.mock.calls[0] as [string, AbortSignal];
    expect(id).toBe("a1");
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("waits for the album, and shrugs off a failure", async () => {
    lookUpAlbumNow.mockRejectedValue(new Error("offline"));
    const useAlbumLookup = await load();

    const { rerender } = renderHook(({ id }) => useAlbumLookup(id), {
      initialProps: { id: undefined as string | undefined },
    });
    expect(lookUpAlbumNow).not.toHaveBeenCalled();

    rerender({ id: "a1" });
    expect(lookUpAlbumNow).toHaveBeenCalledOnce();
  });
});
