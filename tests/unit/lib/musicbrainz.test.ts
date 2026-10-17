import { afterEach, describe, expect, it, vi } from "vitest";

import {
  coverArtUrl,
  coverThumbnailUrl,
  findLinks,
  parseLinks,
  parseReleaseGroups,
  RateLimitedError,
  releasesUrl,
  searchMusicBrainz,
  searchReleaseGroups,
  searchReleaseGroupsByText,
  searchUrl,
  textSearchUrl,
} from "@/lib/musicbrainz";

const GROUP = {
  id: "rg1",
  title: "Made-up Title",
  "first-release-date": "1999-05-01",
  "primary-type": "Album",
  "artist-credit": [{ name: "Zeta", joinphrase: " & " }, { name: "Band" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchUrl", () => {
  it("searches the title and artist, escaping Lucene syntax", () => {
    const url = new URL(searchUrl({ artist: "AC/DC", title: "Help! (Live)" }));
    expect(url.origin + url.pathname).toBe(
      "https://musicbrainz.org/ws/2/release-group/",
    );
    expect(url.searchParams.get("query")).toBe(
      'releasegroup:(Help\\! \\(Live\\)) AND (artist:"AC\\/DC"^3 OR artist:(AC\\/DC))',
    );
    expect(url.searchParams.get("fmt")).toBe("json");
    expect(url.searchParams.get("limit")).toBe("25");
  });
});

describe("textSearchUrl", () => {
  it("looks for the typed words in the title or the artist, escaped", () => {
    const url = new URL(textSearchUrl("  AC/DC Back in Black! "));
    expect(url.origin + url.pathname).toBe(
      "https://musicbrainz.org/ws/2/release-group/",
    );
    expect(url.searchParams.get("query")).toBe(
      "releasegroup:(AC\\/DC Back in Black\\!) OR artist:(AC\\/DC Back in Black\\!)",
    );
    expect(url.searchParams.get("limit")).toBe("25");
  });
});

describe("coverArtUrl", () => {
  it("points at the release group's front cover", () => {
    expect(coverArtUrl("rg1")).toBe(
      "https://coverartarchive.org/release-group/rg1/front-1200",
    );
  });

  it("has a small version for search results", () => {
    expect(coverThumbnailUrl("rg1")).toBe(
      "https://coverartarchive.org/release-group/rg1/front-250",
    );
  });
});

describe("parseReleaseGroups", () => {
  it("reads id, title, joined artist credit, year and type", () => {
    expect(parseReleaseGroups({ "release-groups": [GROUP] })).toEqual([
      {
        id: "rg1",
        title: "Made-up Title",
        artist: "Zeta & Band",
        year: 1999,
        primaryType: "Album",
      },
    ]);
  });

  it("leaves an unknown year and type empty", () => {
    const [group] = parseReleaseGroups({
      "release-groups": [
        { id: "x", title: "T", "artist-credit": [{ name: "A" }] },
      ],
    });
    expect(group).toMatchObject({ year: null, primaryType: null });
  });

  it("drops malformed entries and anything that isn't a search result", () => {
    expect(
      parseReleaseGroups({ "release-groups": [GROUP, { id: 1 }] }),
    ).toHaveLength(1);
    expect(parseReleaseGroups(null)).toEqual([]);
  });
});

describe("searchReleaseGroups", () => {
  const album = { artist: "Zeta Band", title: "Made-up Title" };

  function respond(status: number, body: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fetches without credentials or referrer and parses the result", async () => {
    const fetchMock = respond(200, { "release-groups": [GROUP] });

    const groups = await searchReleaseGroups(album);

    expect(groups.map((group) => group.id)).toEqual(["rg1"]);
    expect(fetchMock).toHaveBeenCalledWith(searchUrl(album), {
      signal: undefined,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  });

  it("searches by typed text the same way", async () => {
    const fetchMock = respond(200, { "release-groups": [GROUP] });

    const groups = await searchReleaseGroupsByText("zeta made-up");

    expect(groups.map((group) => group.id)).toEqual(["rg1"]);
    expect(fetchMock).toHaveBeenCalledWith(
      textSearchUrl("zeta made-up"),
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it.each([503, 429])("reports HTTP %i as a rate limit", async (status) => {
    respond(status);
    await expect(searchReleaseGroups(album)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it("rejects on any other failed response", async () => {
    respond(500);
    await expect(searchReleaseGroups(album)).rejects.toThrow("HTTP 500");
  });

  it("returns matches with the archive's cover", async () => {
    respond(200, { "release-groups": [GROUP] });

    expect(await searchMusicBrainz(album)).toEqual([
      {
        id: "rg1",
        title: "Made-up Title",
        artist: "Zeta & Band",
        year: 1999,
        type: "album",
        coverUrl: "https://coverartarchive.org/release-group/rg1/front-1200",
        links: {},
      },
    ]);
  });

  it("leaves an unknown type empty in a match", async () => {
    respond(200, {
      "release-groups": [{ ...GROUP, "primary-type": undefined }],
    });
    const [match] = await searchMusicBrainz(album);
    expect(match.type).toBeNull();
  });
});

describe("streaming links", () => {
  const releases = (...resources: string[]) => ({
    releases: [
      { relations: [] },
      { relations: resources.map((resource) => ({ url: { resource } })) },
    ],
  });

  it("asks for the release group's releases with their links", () => {
    const url = new URL(releasesUrl("rg1"));
    expect(url.origin + url.pathname).toBe(
      "https://musicbrainz.org/ws/2/release",
    );
    expect(url.searchParams.get("release-group")).toBe("rg1");
    expect(url.searchParams.get("inc")).toBe("url-rels");
  });

  it("reads each service's first album link, in its plain form", () => {
    expect(
      parseLinks(
        releases(
          "https://www.discogs.com/release/1",
          "http://deezer.com/fr/album/126502",
          "https://www.deezer.com/album/2",
          "https://open.spotify.com/album/abc123",
        ),
      ),
    ).toEqual({
      deezer: "https://www.deezer.com/album/126502",
      spotify: "https://open.spotify.com/album/abc123",
    });
  });

  it("is empty without links, or for an unexpected response", () => {
    expect(parseLinks({ releases: [{}] })).toEqual({});
    expect(parseLinks("nope")).toEqual({});
  });

  it("fetches them, reading 503 as rate limiting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(releases("https://www.deezer.com/album/7")),
      }),
    );
    await expect(findLinks("rg1")).resolves.toEqual({
      deezer: "https://www.deezer.com/album/7",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    await expect(findLinks("rg1")).rejects.toBeInstanceOf(RateLimitedError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(findLinks("rg1")).rejects.toThrow("MusicBrainz: HTTP 500");
  });
});
