import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// use-install-prompt.ts reads/writes the persisted "installed" flag through
// app-settings.ts, which caches its data in a module-level singleton loaded
// from IndexedDB in the background — without a fresh module instance per
// test, one test's markInstalled() would leak into every test after it, and
// without awaiting app-settings' own `whenLoaded()`, the hook would mount
// before a seeded "installed" flag has finished loading.
async function freshInstallPrompt() {
  vi.resetModules();
  const appSettings = await import("@/lib/app-settings");
  await appSettings.whenLoaded();
  return import("@/hooks/use-install-prompt");
}

// markInstalled()'s write is fire-and-forget, and a first-ever IndexedDB
// open in a generation also runs the upgrade path, which can take more than
// one macrotask tick — poll for the observable effect (idb-store's kvGet,
// re-imported fresh since a static binding wouldn't follow
// vi.resetModules()) rather than guessing a fixed delay, or the next test's
// resetIndexedDb() can close the connection mid-write.
async function waitForInstalledWrite(): Promise<void> {
  const { kvGet } = await import("@/lib/idb-store");
  await vi.waitFor(async () => {
    const stored = await kvGet<{ installed?: boolean }>(SETTINGS_KEY);
    expect(stored?.installed).toBe(true);
  });
}

// jsdom doesn't implement matchMedia at all, so a controllable fake stands in
// for the real MediaQueryList — one shared instance per test so subscribe()
// and the snapshot getter both observe the same "matches" state.
function createMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: { matches: boolean }) => void>();
  return {
    get matches() {
      return matches;
    },
    media: "(display-mode: standalone)",
    addEventListener: (
      type: string,
      listener: (event: { matches: boolean }) => void,
    ) => {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener: (
      type: string,
      listener: (event: { matches: boolean }) => void,
    ) => {
      if (type === "change") listeners.delete(listener);
    },
    set(next: boolean) {
      matches = next;
    },
  };
}

let mql: ReturnType<typeof createMatchMediaMock>;

beforeEach(async () => {
  await resetIndexedDb();
  mql = createMatchMediaMock(false);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
});

afterEach(() => {
  // Unmount every hook this file rendered before touching globals/mocks —
  // isolate: false means these components would otherwise sit alive across
  // test files, keeping their beforeinstallprompt/appinstalled window
  // listeners registered against an old module generation. A later test's
  // dispatchEvent then also reaches those stale listeners, which call
  // markInstalled() against an idb-store connection a subsequent
  // resetIndexedDb() has since invalidated — an unhandled InvalidStateError
  // attributed to whatever test happens to be running at that point.
  cleanup();
  vi.unstubAllGlobals();
  // vi.spyOn(window, "removeEventListener") below isn't undone by
  // unstubAllGlobals — with isolate: false, window is the same real object
  // shared across every test file in the run.
  vi.restoreAllMocks();
});

describe("useInstallPrompt", () => {
  it("starts unavailable when not standalone and no prompt yet", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("unavailable");
  });

  it("install() is a no-op when there is no pending prompt", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      await result.current.install();
    });
    expect(result.current.state).toBe("unavailable");
  });

  it("reports installed immediately when already running standalone", async () => {
    mql.set(true);
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("falls back to navigator.standalone for iOS Safari", async () => {
    // matchMedia's display-mode query predates iOS Safari, which sets its
    // own navigator.standalone flag instead — isStandalone() checks both.
    vi.stubGlobal("navigator", { standalone: true });
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("reports installed from a previously persisted flag alone", async () => {
    // resetModules before this seed write (not just inside
    // freshInstallPrompt() below) — idb-store.ts caches its DB connection at
    // module scope, and reusing a connection opened before this test's
    // beforeEach deleted the database throws InvalidStateError.
    vi.resetModules();
    const { kvSet } = await import("@/lib/idb-store");
    await kvSet(SETTINGS_KEY, { installed: true });
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("becomes available after beforeinstallprompt, then installed on acceptance", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: promptFn,
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      },
    );
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.state).toBe("available");

    await act(async () => {
      await result.current.install();
    });

    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("installed");
  });

  it("stays unavailable after a dismissed prompt", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed" as const }),
      },
    );
    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.state).toBe("unavailable");
  });

  it("switches to installed on the appinstalled event", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.state).toBe("installed");
    await waitForInstalledWrite();
  });

  it("persists installed on appinstalled, surviving a later fresh load", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    // markInstalled()'s write is fire-and-forget — wait for it to actually
    // land before resetModules() orphans this generation's connection, or a
    // later test's resetIndexedDb() can close it mid-write (unhandled
    // rejection). Real IndexedDB timing can take more than one macrotask
    // tick (a first-ever open also runs the upgrade path), so this polls for
    // the observable effect rather than guessing a delay.
    await waitForInstalledWrite();

    // Simulates a later page load: a fresh module instance, still not
    // standalone, with no beforeinstallprompt offered this time either.
    const { useInstallPrompt: useInstallPromptAgain } =
      await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPromptAgain());
    expect(result.current.state).toBe("installed");
  });

  it("persists installed once standalone, surviving a later non-standalone load", async () => {
    mql.set(true);
    const { useInstallPrompt } = await freshInstallPrompt();
    renderHook(() => useInstallPrompt());
    // Mounting already-standalone marks installed — same fire-and-forget
    // write, same reasoning as the test above.
    await waitForInstalledWrite();

    // Simulates opening the same app later from a plain browser tab, where
    // Chrome no longer offers beforeinstallprompt for an already-installed app.
    mql.set(false);
    const { useInstallPrompt: useInstallPromptAgain } =
      await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPromptAgain());
    expect(result.current.state).toBe("installed");
  });

  it("removes its event listeners on unmount", async () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { useInstallPrompt } = await freshInstallPrompt();
    const { unmount } = renderHook(() => useInstallPrompt());
    unmount();

    expect(removeListener).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "appinstalled",
      expect.any(Function),
    );
  });
});
