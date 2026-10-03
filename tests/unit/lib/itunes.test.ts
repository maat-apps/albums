import { afterEach, describe, expect, it, vi } from "vitest";

import {
  largerArtwork,
  parseItunesAlbums,
  searchItunes,
  searchUrl,
} from "@/lib/itunes";
import { RateLimitedError } from "@/lib/musicbrainz";

const ITEM = {
  collectionId: 123,
  collectionName: "Made-up Title",
  artistName: "Zeta Band",
  artworkUrl100:
    "https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100bb.jpg",
  releaseDate: "1999-05-01T07:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchUrl", () => {
  it("searches albums for the artist and title", () => {
    const url = new URL(searchUrl({ artist: "Zeta Band", title: "A & B" }));
    expect(url.origin + url.pathname).toBe("https://itunes.apple.com/search");
    expect(url.searchParams.get("term")).toBe("Zeta Band A & B");
    expect(url.searchParams.get("entity")).toBe("album");
  });
});

describe("largerArtwork", () => {
  it("asks for 600px instead of 100px", () => {
    expect(largerArtwork(ITEM.artworkUrl100)).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg",
    );
  });

  it("leaves an unrecognised URL alone", () => {
    expect(largerArtwork("https://example.com/cover")).toBe(
      "https://example.com/cover",
    );
  });
});

describe("parseItunesAlbums", () => {
  it("reads id, title, artist, year, type and a larger cover", () => {
    expect(parseItunesAlbums({ results: [ITEM] })).toEqual([
      {
        id: "123",
        title: "Made-up Title",
        artist: "Zeta Band",
        year: 1999,
        type: "album",
        coverUrl:
          "https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg",
        spotifyUrl: null,
      },
    ]);
  });

  it("reads a single or EP from its name's suffix", () => {
    const [single, ep] = parseItunesAlbums({
      results: [
        { ...ITEM, collectionName: "Made-up Title - Single" },
        { ...ITEM, collectionName: "Made-up Title - EP" },
      ],
    });
    expect(single).toMatchObject({ title: "Made-up Title", type: "single" });
    expect(ep).toMatchObject({ title: "Made-up Title", type: "ep" });
  });

  it("leaves an unknown year and cover empty, and drops malformed entries", () => {
    const albums = parseItunesAlbums({
      results: [
        { ...ITEM, releaseDate: undefined, artworkUrl100: undefined },
        { collectionName: "No id" },
      ],
    });
    expect(albums).toHaveLength(1);
    expect(albums[0]).toMatchObject({ year: null, coverUrl: null });
  });

  it("is empty for an unexpected response", () => {
    expect(parseItunesAlbums("nope")).toEqual([]);
  });
});

describe("searchItunes", () => {
  const album = { artist: "Zeta Band", title: "Made-up Title" };

  it("returns the parsed matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [ITEM] }),
      }),
    );
    await expect(searchItunes(album)).resolves.toHaveLength(1);
  });

  it("reads 403 and 429 as rate limiting", async () => {
    for (const status of [403, 429]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
      await expect(searchItunes(album)).rejects.toBeInstanceOf(
        RateLimitedError,
      );
    }
  });

  it("rejects on any other failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(searchItunes(album)).rejects.toThrow("iTunes: HTTP 500");
  });
});
