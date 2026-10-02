import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();

// Fresh modules with the session mocked (vitest.config's isolate: false
// shares one module graph, so a hoisted vi.mock would leak).
async function load() {
  vi.resetModules();
  vi.doMock("@/lib/spotify-session", () => ({ getAccessToken }));
  return {
    ...(await import("@/lib/spotify-api")),
    RateLimitedError: (await import("@/lib/musicbrainz")).RateLimitedError,
  };
}

const ITEM = {
  id: "sp1",
  name: "Made-up Title",
  album_type: "ALBUM",
  release_date: "1999-05-01",
  artists: [{ name: "Zeta" }, { name: "Band" }],
  images: [
    { url: "https://i.scdn.co/image/640" },
    { url: "https://i.scdn.co/image/300" },
  ],
  external_urls: { spotify: "https://open.spotify.com/album/sp1" },
};

function response(status: number, body: unknown = {}, retryAfter?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(retryAfter ? { "Retry-After": retryAfter } : {}),
    json: () => Promise.resolve(body),
  };
}

const album = { artist: 'Zeta: "Band"', title: "Made-up Title" };

let api: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  getAccessToken.mockReset().mockResolvedValue("token");
  api = await load();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/spotify-session");
});

describe("spotifySearchQuery", () => {
  it("filters by album and artist, without quotes or colons", () => {
    expect(api.spotifySearchQuery(album)).toBe(
      "album:Made-up Title artist:Zeta   Band ",
    );
  });
});

describe("parseSpotifyAlbums", () => {
  it("maps an album to a match with its largest cover and link", () => {
    expect(api.parseSpotifyAlbums({ albums: { items: [ITEM] } })).toEqual([
      {
        id: "sp1",
        title: "Made-up Title",
        artist: "Zeta, Band",
        year: 1999,
        type: "album",
        coverUrl: "https://i.scdn.co/image/640",
        spotifyUrl: "https://open.spotify.com/album/sp1",
      },
    ]);
  });

  it("leaves missing details empty and drops malformed items", () => {
    const bare = { id: "b", name: "B", artists: [], external_urls: {} };
    expect(
      api.parseSpotifyAlbums({ albums: { items: [bare, { id: 1 }] } }),
    ).toEqual([
      {
        id: "b",
        title: "B",
        artist: "",
        year: null,
        type: null,
        coverUrl: null,
        spotifyUrl: null,
      },
    ]);
    expect(api.parseSpotifyAlbums(null)).toEqual([]);
  });
});

describe("searchSpotify", () => {
  it("searches albums with the user's token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { albums: { items: [ITEM] } }));
    vi.stubGlobal("fetch", fetchMock);

    const matches = await api.searchSpotify(album);

    expect(matches).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe(api.spotifySearchQuery(album));
    expect(params.get("type")).toBe("album");
    expect(init.headers).toEqual({ Authorization: "Bearer token" });
  });

  it("refreshes the token once when Spotify rejects it", async () => {
    getAccessToken.mockResolvedValueOnce("old").mockResolvedValueOnce("new");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { albums: { items: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await api.searchSpotify(album);

    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a rate limit with Spotify's Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, {}, "7")));
    const error = await api
      .searchSpotify(album)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(api.RateLimitedError);
    expect(
      (error as InstanceType<typeof api.RateLimitedError>).retryAfter,
    ).toBe(7000);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429)));
    const bare = await api
      .searchSpotify(album)
      .catch((caught: unknown) => caught);
    expect(
      (bare as InstanceType<typeof api.RateLimitedError>).retryAfter,
    ).toBeNull();
  });

  it("rejects any other failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(500)));
    await expect(api.searchSpotify(album)).rejects.toThrow("HTTP 500");
  });
});
