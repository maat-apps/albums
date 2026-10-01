import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

beforeEach(async () => {
  await resetIndexedDb();
});

describe("useAppSettings / useSettingsReady", () => {
  it("reflects settings once loaded", async () => {
    vi.resetModules();
    const { useAppSettings, useSettingsReady } =
      await import("@/hooks/use-app-settings");
    const settings = await import("@/lib/app-settings");
    const { result } = renderHook(() => ({
      settings: useAppSettings(),
      ready: useSettingsReady(),
    }));

    await act(() => settings.whenLoaded());

    expect(result.current.ready).toBe(true);
    expect(result.current.settings.lock).toBeNull();
  });
});
