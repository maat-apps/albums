import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

const URL_A = "https://coverartarchive.org/release/a/front-250";
const URL_B = "https://coverartarchive.org/release/b/front-250";

function imageResponse(): Response {
  const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
  return { ok: true, blob: () => Promise.resolve(blob) } as Response;
}

let observers: {
  callback: IntersectionObserverCallback;
  disconnect: () => void;
}[];

class FakeIntersectionObserver {
  disconnect = vi.fn();
  constructor(public callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe() {}
}

function intersect(isIntersecting: boolean) {
  for (const observer of observers) {
    observer.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  }
}

async function load() {
  vi.resetModules();
  return (await import("@/hooks/use-cover-src")).useCoverSrc;
}

const element = { current: document.createElement("div") };

beforeEach(async () => {
  await resetIndexedDb();
  observers = [];
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:cover");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCoverSrc", () => {
  it("is null for an album without a cover", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const useCoverSrc = await load();

    const { result } = renderHook(() => useCoverSrc({ id: "a1" }, element));

    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads only once the cover scrolls into view, as an object URL", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal("fetch", fetchMock);
    const useCoverSrc = await load();

    const { result, unmount } = renderHook(() =>
      useCoverSrc({ id: "a1", coverUrl: URL_A }, element),
    );
    act(() => intersect(false));
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => intersect(true));
    await waitFor(() => expect(result.current).toBe("blob:cover"));
    expect(observers[0].disconnect).toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover");
  });

  it("falls back to the cover URL when it can't be stored", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("cors")));
    const useCoverSrc = await load();

    const { result, rerender } = renderHook(
      ({ coverUrl }) => useCoverSrc({ id: "a1", coverUrl }, element),
      { initialProps: { coverUrl: URL_A } },
    );
    await waitFor(() => expect(result.current).toBe(URL_A));

    rerender({ coverUrl: URL_B });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(URL_B));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("ignores a load that finishes after unmounting", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    let respond: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))),
    );
    const useCoverSrc = await load();

    const { unmount } = renderHook(() =>
      useCoverSrc({ id: "a1", coverUrl: URL_A }, element),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    unmount();
    respond(imageResponse());
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("waits for the element before observing", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const useCoverSrc = await load();

    renderHook(() =>
      useCoverSrc({ id: "a1", coverUrl: URL_A }, { current: null }),
    );

    expect(observers).toHaveLength(0);
  });
});
