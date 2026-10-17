import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

const PROGRESS = { total: 1, done: 1, matched: 1, review: 0, notFound: 0 };

async function load(
  lookUpCovers: (options: {
    signal: AbortSignal;
    onProgress: (progress: typeof PROGRESS) => void;
  }) => Promise<typeof PROGRESS>,
) {
  vi.resetModules();
  vi.doMock("@/lib/cover-lookup-runner", () => ({ lookUpCovers }));
  return (await import("@/hooks/use-cover-lookup")).useCoverLookup;
}

beforeEach(async () => {
  await resetIndexedDb();
});

afterEach(() => {
  vi.doUnmock("@/lib/cover-lookup-runner");
});

describe("useCoverLookup", () => {
  it("runs to done, reporting progress", async () => {
    const useCoverLookup = await load(async ({ onProgress }) => {
      onProgress(PROGRESS);
      return PROGRESS;
    });
    const { result } = renderHook(() => useCoverLookup(["musicbrainz"]));
    expect(result.current.phase).toBe("idle");

    act(() => result.current.start());

    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(result.current.progress).toEqual(PROGRESS);
  });

  it("stops on request", async () => {
    const useCoverLookup = await load(
      ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(PROGRESS));
        }),
    );
    const { result } = renderHook(() => useCoverLookup(["musicbrainz"]));

    act(() => result.current.start());
    expect(result.current.phase).toBe("running");
    act(() => result.current.stop());

    await waitFor(() => expect(result.current.phase).toBe("stopped"));
  });

  it("keeps running when the screen closes, and shows the run on return", async () => {
    const signals: AbortSignal[] = [];
    const useCoverLookup = await load(
      ({ signal }) =>
        new Promise(() => {
          signals.push(signal);
        }),
    );
    const first = renderHook(() => useCoverLookup(["musicbrainz"]));
    act(() => first.result.current.start());
    first.unmount();

    const second = renderHook(() => useCoverLookup(["musicbrainz"]));
    expect(signals[0].aborted).toBe(false);
    expect(second.result.current.phase).toBe("running");

    // Starting again while it runs doesn't begin a second run.
    act(() => second.result.current.start());
    expect(signals).toHaveLength(1);
  });

  it("reports a failed run", async () => {
    const useCoverLookup = await load(() =>
      Promise.reject(new TypeError("offline")),
    );
    const { result } = renderHook(() => useCoverLookup(["musicbrainz"]));

    act(() => result.current.start());

    await waitFor(() => expect(result.current.phase).toBe("failed"));
  });
});
