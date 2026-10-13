import { describe, expect, it } from "vitest";

import { isHttpsUrl, parseAlbums } from "@/lib/schemas";

const valid = {
  id: "a1",
  year: 1977,
  artist: "Artist",
  title: "Title",
  status: "comingBack",
  coverUrl: "https://example.com/cover.jpg",
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

  it("falls back for an unknown status, a bad year and a non-https URL", () => {
    const [album] = parseAlbums([
      {
        ...valid,
        status: "maybe",
        year: 19.5,
        coverUrl: "http://example.com/a.jpg",
      },
    ]);
    expect(album).toMatchObject({ status: "toListen", year: null });
    expect(album?.coverUrl).toBeUndefined();
  });

  it("keeps streaming links and their verdict, and drops a non-https link", () => {
    const linked = {
      ...valid,
      deezerUrl: "https://www.deezer.com/album/302127",
      spotifyUrl: "https://open.spotify.com/album/abc",
      appleMusicUrl: "https://music.apple.com/us/album/1",
      linksLookup: "done",
    };
    expect(parseAlbums([linked])).toEqual([linked]);
    const [album] = parseAlbums([
      { ...valid, deezerUrl: "http://www.deezer.com/album/1" },
    ]);
    expect(album?.deezerUrl).toBeUndefined();
  });

  it("reads a cover saved at a smaller size as its 1200px version", () => {
    const [album] = parseAlbums([
      {
        ...valid,
        coverUrl: "https://coverartarchive.org/release-group/x/front-250",
      },
    ]);
    expect(album?.coverUrl).toBe(
      "https://coverartarchive.org/release-group/x/front-1200",
    );
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
