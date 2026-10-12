import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deezerSearchUrl,
  parseDeezerAlbums,
  searchDeezer,
  searchUrl,
} from "@/lib/deezer";
import { RateLimitedError } from "@/lib/musicbrainz";

const ITEM = {
  id: 302127,
  title: "Made-up Title",
  link: "https://www.deezer.com/album/302127",
  cover_xl: "https://e-cdns-images.dzcdn.net/images/cover/abc/1000x1000.jpg",
  md5_image: "abc",
  record_type: "Album",
  artist: { id: 27, name: "Zeta Band" },
  type: "album",
};

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchUrl", () => {
  it("searches albums by artist and title, quotes stripped", () => {
    const url = new URL(
      searchUrl({ artist: "Zeta Band", title: 'The "Best" & More' }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://api.deezer.com/search/album",
    );
    expect(url.searchParams.get("q")).toBe(
      'artist:"Zeta Band" album:"The  Best  & More"',
    );
  });
});

describe("deezerSearchUrl", () => {
  it("opens Deezer's search for the artist and title", () => {
    expect(deezerSearchUrl({ artist: "Zeta Band", title: "A/B" })).toBe(
      "https://www.deezer.com/search/Zeta%20Band%20A%2FB",
    );
  });
});

describe("parseDeezerAlbums", () => {
  it("reads id, title, artist, type, cover and link; no year", () => {
    expect(parseDeezerAlbums({ data: [ITEM], total: 1 })).toEqual([
      {
        id: "302127",
        title: "Made-up Title",
        artist: "Zeta Band",
        year: null,
        type: "album",
        coverUrl: ITEM.cover_xl,
        deezerUrl: ITEM.link,
      },
    ]);
  });

  it("leaves out a placeholder cover, a non-https URL and a missing type", () => {
    const [album] = parseDeezerAlbums({
      data: [
        {
          ...ITEM,
          md5_image: "",
          link: "http://www.deezer.com/album/302127",
          record_type: undefined,
        },
      ],
    });
    expect(album).toMatchObject({
      coverUrl: null,
      deezerUrl: null,
      type: null,
    });
  });

  it("leaves out a missing cover and link, and drops malformed entries", () => {
    const albums = parseDeezerAlbums({
      data: [{ ...ITEM, cover_xl: null, link: undefined }, { title: "No id" }],
    });
    expect(albums).toHaveLength(1);
    expect(albums[0]).toMatchObject({ coverUrl: null, deezerUrl: null });
  });

  it("is empty for an unexpected response", () => {
    expect(parseDeezerAlbums("nope")).toEqual([]);
  });
});

describe("searchDeezer", () => {
  const album = { artist: "Zeta Band", title: "Made-up Title" };

  it("returns the parsed matches, sending no credentials", async () => {
    const fetchMock = respond({ data: [ITEM] });
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchDeezer(album)).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
    });
  });

  it("reads the quota error and HTTP 429 as rate limiting", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ error: { type: "Exception", message: "Quota", code: 4 } }),
    );
    await expect(searchDeezer(album)).rejects.toBeInstanceOf(RateLimitedError);
    vi.stubGlobal("fetch", respond({}, 429));
    await expect(searchDeezer(album)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("rejects on any other error", async () => {
    vi.stubGlobal("fetch", respond({ error: { code: 700 } }));
    await expect(searchDeezer(album)).rejects.toThrow("Deezer: error 700");
    vi.stubGlobal("fetch", respond({ error: {} }));
    await expect(searchDeezer(album)).rejects.toThrow("Deezer: error unknown");
    vi.stubGlobal("fetch", respond({}, 500));
    await expect(searchDeezer(album)).rejects.toThrow("Deezer: HTTP 500");
  });
});
