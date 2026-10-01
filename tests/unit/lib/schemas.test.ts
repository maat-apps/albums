import { describe, expect, it } from "vitest";

import { isHttpsUrl, parseAlbums } from "@/lib/schemas";

const valid = {
  id: "a1",
  year: 1977,
  artist: "Artist",
  title: "Title",
  status: "comingBack",
  coverUrl: "https://coverartarchive.org/release/x/front",
  spotifyUrl: "https://open.spotify.com/album/x",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("parseAlbums", () => {
  it("keeps a valid album", () => {
    expect(parseAlbums([valid])).toEqual([valid]);
  });

  it("drops only malformed albums", () => {
    expect(parseAlbums([valid, { ...valid, artist: 1 }, "x"])).toEqual([valid]);
  });

  it("falls back for an unknown status, a bad year and non-https URLs", () => {
    const [album] = parseAlbums([
      {
        ...valid,
        status: "maybe",
        year: 19.5,
        coverUrl: "http://example.com/a.jpg",
        spotifyUrl: "not a url",
      },
    ]);
    expect(album).toMatchObject({ status: "toListen", year: null });
    expect(album?.coverUrl).toBeUndefined();
    expect(album?.spotifyUrl).toBeUndefined();
  });

  it("is empty for anything that isn't an array", () => {
    expect(parseAlbums({})).toEqual([]);
  });
});

describe("isHttpsUrl", () => {
  it("accepts https and rejects everything else", () => {
    expect(isHttpsUrl("https://example.com")).toBe(true);
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl("example")).toBe(false);
  });
});
