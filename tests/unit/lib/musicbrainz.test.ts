import { afterEach, describe, expect, it, vi } from "vitest";

import {
  coverArtUrl,
  parseReleaseGroups,
  RateLimitedError,
  searchReleaseGroups,
  searchUrl,
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
      "releasegroup:(Help\\! \\(Live\\)) AND artist:(AC\\/DC)",
    );
    expect(url.searchParams.get("fmt")).toBe("json");
  });
});

describe("coverArtUrl", () => {
  it("points at the release group's front cover", () => {
    expect(coverArtUrl("rg1")).toBe(
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
});
