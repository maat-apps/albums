import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authorizeUrl,
  codeChallenge,
  exchangeCode,
  randomToken,
  redirectUri,
  refreshToken,
  SPOTIFY_CLIENT_ID,
  SpotifyAuthError,
} from "@/lib/spotify-auth";

const NOW = 1_000_000;

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body instanceof Error ? Promise.reject(body) : Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentParams(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, params: init.body as URLSearchParams };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PKCE helpers", () => {
  it("derives RFC 7636's example S256 challenge", async () => {
    expect(
      await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes long, URL-safe, different random tokens", () => {
    const token = randomToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(randomToken()).not.toBe(token);
  });

  it("redirects back to the app's root", () => {
    expect(redirectUri()).toBe(`${window.location.origin}/`);
  });

  it("builds the authorize URL without scopes", () => {
    const url = new URL(authorizeUrl("st", "ch"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.spotify.com/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      redirect_uri: redirectUri(),
      state: "st",
      code_challenge_method: "S256",
      code_challenge: "ch",
    });
  });
});

describe("token requests", () => {
  it("exchanges a code for a token", async () => {
    const fetchMock = respond(200, {
      access_token: "at",
      expires_in: 3600,
      refresh_token: "rt",
    });

    const token = await exchangeCode("code", "verifier", NOW);

    expect(token).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: NOW + 3_600_000,
    });
    const { url, init, params } = sentParams(fetchMock);
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(params)).toEqual({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: redirectUri(),
      code_verifier: "verifier",
    });
  });

  it("refreshes, keeping the old refresh token unless rotated", async () => {
    const old = { accessToken: "a", refreshToken: "r1", expiresAt: 0 };
    const fetchMock = respond(200, { access_token: "a2", expires_in: 60 });

    expect(await refreshToken(old, NOW)).toEqual({
      accessToken: "a2",
      refreshToken: "r1",
      expiresAt: NOW + 60_000,
    });
    expect(Object.fromEntries(sentParams(fetchMock).params)).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "r1",
    });

    respond(200, { access_token: "a3", expires_in: 60, refresh_token: "r2" });
    expect((await refreshToken(old, NOW)).refreshToken).toBe("r2");
  });

  it("uses the current time by default", async () => {
    respond(200, { access_token: "a", expires_in: 60, refresh_token: "r" });
    const before = Date.now();
    const token = await exchangeCode("c", "v");
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 60_000);
    respond(200, { access_token: "a", expires_in: 60 });
    expect(
      (
        await refreshToken({
          accessToken: "x",
          refreshToken: "r",
          expiresAt: 0,
        })
      ).expiresAt,
    ).toBeGreaterThanOrEqual(before + 60_000);
  });

  it.each([
    ["a refused request", 400, { error: "invalid_grant" }],
    ["an unreadable body", 200, new Error("not json")],
    [
      "a code exchange without a refresh token",
      200,
      { access_token: "a", expires_in: 1 },
    ],
  ])("rejects %s", async (_, status, body) => {
    respond(status, body);
    await expect(exchangeCode("c", "v", NOW)).rejects.toBeInstanceOf(
      SpotifyAuthError,
    );
  });
});
