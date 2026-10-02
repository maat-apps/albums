import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

const TOKEN = { accessToken: "at", refreshToken: "rt", expiresAt: 0 };

const exchangeCode = vi.fn();
const refreshToken = vi.fn();

// Fresh modules (the session keeps module state) with the token requests
// mocked; the rest of spotify-auth stays real.
async function fresh() {
  vi.resetModules();
  vi.doMock("@/lib/spotify-auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/spotify-auth")>()),
    exchangeCode,
    refreshToken,
  }));
  const session = await import("@/lib/spotify-session");
  const { kvGet, kvSet } = await import("@/lib/idb-store");
  const { SPOTIFY_KEY } = await import("@/lib/storage-keys");
  const { encryptionKey } = await import("@/lib/encryption-key");
  return {
    session,
    encryptionKey,
    stored: () => kvGet<unknown>(SPOTIFY_KEY),
    store: (value: unknown) => kvSet(SPOTIFY_KEY, value),
  };
}

async function testKey() {
  const { deriveKey, randomBytes } = await import("@maat-apps/core/crypto");
  return deriveKey(randomBytes(32), randomBytes(16), "test-data-v1");
}

function pendingLogin(state = "st") {
  sessionStorage.setItem(
    "albums-spotify-pending",
    JSON.stringify({ state, verifier: "ver" }),
  );
}

beforeEach(async () => {
  await resetIndexedDb();
  sessionStorage.clear();
  exchangeCode.mockReset();
  refreshToken.mockReset();
});

afterEach(() => {
  vi.doUnmock("@/lib/spotify-auth");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loading", () => {
  it("starts disconnected and reads a stored token", async () => {
    const first = await fresh();
    await first.session.whenLoaded();
    expect(first.session.isConnected()).toBe(false);

    await first.store(TOKEN);
    const second = await fresh();
    await second.session.whenLoaded();
    expect(second.session.isConnected()).toBe(true);
  });

  it("ignores a malformed or unreadable token", async () => {
    const first = await fresh();
    await first.store({ accessToken: 1 });
    const second = await fresh();
    await second.session.whenLoaded();
    expect(second.session.isConnected()).toBe(false);

    const { keyValueStore } = await import("@/lib/idb-store");
    vi.spyOn(keyValueStore, "get").mockRejectedValueOnce(new Error("disk"));
    await second.session.whenLoaded();
    const third = await fresh();
    const { keyValueStore: store } = await import("@/lib/idb-store");
    vi.spyOn(store, "get").mockRejectedValueOnce(new Error("disk"));
    await third.session.whenLoaded();
    expect(third.session.isConnected()).toBe(false);
  });

  it("waits for the lock's key and decrypts", async () => {
    const key = await testKey();
    const { encryptJson } = await import("@maat-apps/core/crypto");
    const setup = await fresh();
    await setup.store(await encryptJson(key, TOKEN));
    const { setLockEnrolment, whenLoaded } = await import("@/lib/app-settings");
    await whenLoaded();
    setLockEnrolment({
      credentialId: "c",
      userId: "u",
      createdAt: "2026-10-01T00:00:00.000Z",
      encryptionSupported: true,
      prfSalt: "s",
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const { session, encryptionKey } = await fresh();
    const loading = session.whenLoaded();
    encryptionKey.set(key);
    await loading;
    expect(session.isConnected()).toBe(true);
  });
});

describe("connecting", () => {
  it("sends the user to Spotify with a PKCE challenge", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign,
      origin: window.location.origin,
    });
    const { session } = await fresh();

    await session.beginConnect();

    const url = new URL(assign.mock.calls[0][0] as string);
    const pending = JSON.parse(
      sessionStorage.getItem("albums-spotify-pending") ?? "{}",
    ) as { state: string };
    expect(url.searchParams.get("state")).toBe(pending.state);
    expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
  });

  it("finishes with the code Spotify sent back, once", async () => {
    exchangeCode.mockResolvedValue(TOKEN);
    const { session, stored } = await fresh();
    pendingLogin();
    const params = new URLSearchParams({ code: "c", state: "st" });

    const [first, second] = await Promise.all([
      session.completeConnect(params),
      session.completeConnect(params),
    ]);

    expect([first, second]).toEqual(["connected", "connected"]);
    expect(exchangeCode).toHaveBeenCalledOnce();
    expect(exchangeCode).toHaveBeenCalledWith("c", "ver");
    expect(session.isConnected()).toBe(true);
    expect(await stored()).toEqual(TOKEN);
  });

  it("encrypts the token while the lock has a key", async () => {
    exchangeCode.mockResolvedValue(TOKEN);
    const { session, stored, encryptionKey } = await fresh();
    encryptionKey.set(await testKey());
    pendingLogin();

    await session.completeConnect(
      new URLSearchParams({ code: "c", state: "st" }),
    );

    const { isEncryptedBlob } = await import("@maat-apps/core/crypto");
    expect(isEncryptedBlob(await stored())).toBe(true);
  });

  it("ignores a URL that isn't a Spotify redirect", async () => {
    const { session } = await fresh();
    expect(await session.completeConnect(new URLSearchParams("a=1"))).toBe(
      "none",
    );
  });

  it.each([
    ["Spotify reports an error", "error=access_denied&state=st", true],
    ["the state doesn't match", "code=c&state=other", true],
    ["no login was started", "code=c&state=st", false],
  ])("fails when %s", async (_, query, started) => {
    const { session } = await fresh();
    if (started) pendingLogin();
    expect(await session.completeConnect(new URLSearchParams(query))).toBe(
      "failed",
    );
  });

  it("fails when the code exchange or pending login is broken", async () => {
    exchangeCode.mockRejectedValue(new Error("refused"));
    const { session } = await fresh();
    pendingLogin();
    expect(
      await session.completeConnect(new URLSearchParams("code=c&state=st")),
    ).toBe("failed");

    sessionStorage.setItem("albums-spotify-pending", "{not json");
    expect(
      await session.completeConnect(new URLSearchParams("code=c&state=st")),
    ).toBe("failed");
  });
});

describe("access tokens", () => {
  async function connected(expiresAt: number) {
    const setup = await fresh();
    await setup.store({ ...TOKEN, expiresAt });
    const loaded = await fresh();
    await loaded.session.whenLoaded();
    return loaded;
  }

  it("throws when not connected", async () => {
    const { session } = await fresh();
    await expect(session.getAccessToken()).rejects.toBeInstanceOf(
      session.NotConnectedError,
    );
  });

  it("returns a token that's still valid without refreshing", async () => {
    const { session } = await connected(Date.now() + 3_600_000);
    expect(await session.getAccessToken()).toBe("at");
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes an expiring (or rejected) token and keeps the new one", async () => {
    refreshToken.mockResolvedValue({ ...TOKEN, accessToken: "fresh" });
    const { session, stored } = await connected(Date.now() + 10_000);

    expect(await session.getAccessToken()).toBe("fresh");
    expect(await stored()).toMatchObject({ accessToken: "fresh" });
    expect(await session.getAccessToken(true)).toBe("fresh");
    expect(refreshToken).toHaveBeenCalledTimes(2);
  });

  it("disconnects when Spotify refuses the refresh", async () => {
    const { session, stored } = await connected(0);
    // The same module graph the session uses.
    const { SpotifyAuthError } = await import("@/lib/spotify-auth");
    refreshToken.mockRejectedValue(new SpotifyAuthError("revoked"));

    await expect(session.getAccessToken()).rejects.toBeInstanceOf(
      session.NotConnectedError,
    );
    expect(session.isConnected()).toBe(false);
    expect(await stored()).toBeUndefined();
  });

  it("keeps the connection on a network error", async () => {
    refreshToken.mockRejectedValue(new TypeError("offline"));
    const { session } = await connected(0);

    await expect(session.getAccessToken()).rejects.toThrow("offline");
    expect(session.isConnected()).toBe(true);
  });
});

describe("disconnecting and the lock", () => {
  it("forgets the token on disconnect", async () => {
    const setup = await fresh();
    await setup.store(TOKEN);
    const { session, stored } = await fresh();

    await session.disconnect();

    expect(session.isConnected()).toBe(false);
    expect(await stored()).toBeUndefined();
  });

  it("re-saves the token under the lock's new key", async () => {
    const setup = await fresh();
    await setup.store(TOKEN);
    const { session, stored, encryptionKey } = await fresh();
    await session.whenLoaded();
    encryptionKey.set(await testKey());

    await session.rewriteSpotifyToken();

    const { isEncryptedBlob } = await import("@maat-apps/core/crypto");
    expect(isEncryptedBlob(await stored())).toBe(true);
  });

  it("is never connected in a server render", async () => {
    const { session } = await fresh();
    expect(session.isConnectedOnServer()).toBe(false);
  });

  it("notifies subscribers of changes", async () => {
    const { session } = await fresh();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    await session.whenLoaded();
    await session.disconnect();
    unsubscribe();
    await session.disconnect();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
