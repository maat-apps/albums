import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

beforeEach(async () => {
  await resetIndexedDb();
});

describe("useGitHubConnection", () => {
  it("is null until connected", async () => {
    vi.resetModules();
    const { useGitHubConnection } = await import("@/hooks/use-github");
    const sync = await import("@/lib/github-sync");
    const { result } = renderHook(() => useGitHubConnection());

    await act(() => sync.whenGitHubLoaded());

    expect(result.current).toBeNull();
  });
});
