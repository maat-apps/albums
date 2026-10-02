import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

beforeEach(async () => {
  await resetIndexedDb();
});

describe("useSpotifyConnected", () => {
  it("follows the session", async () => {
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    await kvSet("albums-spotify", {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 0,
    });
    const { useSpotifyConnected } = await import("@/hooks/use-spotify");
    const session = await import("@/lib/spotify-session");

    const { result } = renderHook(() => useSpotifyConnected());
    await waitFor(() => expect(result.current).toBe(true));

    await act(() => session.disconnect());
    expect(result.current).toBe(false);
  });
});
