import { describe, expect, it } from "vitest";

import {
  applyMatch,
  awaitsReview,
  needsLookup,
  normalize,
  notFound,
  pickMatch,
  spotifySearchUrl,
} from "@/lib/cover-lookup";
import type { ReleaseGroup } from "@/lib/musicbrainz";
import type { Album } from "@/lib/schemas";

const album = (overrides: Partial<Album> = {}): Album => ({
  id: "a1",
  year: 1999,
  artist: "Zeta Band",
  title: "Made-up Title",
  status: "toListen",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const group = (overrides: Partial<ReleaseGroup> = {}): ReleaseGroup => ({
  id: "rg1",
  title: "Made-up Title",
  artist: "Zeta Band",
  year: 1999,
  primaryType: "Album",
  ...overrides,
});

describe("normalize", () => {
  it("ignores case, diacritics, punctuation, brackets and a leading 'the'", () => {
    expect(normalize("The Żółć & Co. (Remastered) [Deluxe]")).toBe(
      "zołc and co",
    );
    expect(normalize("  Kid-A! ")).toBe("kid a");
  });
});

describe("pickMatch", () => {
  it("is none without results", () => {
    expect(pickMatch(album(), [])).toEqual({ kind: "none" });
  });

  it("matches the same artist, title and year", () => {
    const match = group({ title: "made up title (2009 Remaster)" });
    expect(pickMatch(album(), [group({ artist: "Other" }), match])).toEqual({
      kind: "match",
      match,
    });
  });

  it("prefers an album over a single of the same name", () => {
    const single = group({ id: "s", primaryType: "Single" });
    const full = group({ id: "f" });
    expect(pickMatch(album(), [single, full])).toMatchObject({
      match: { id: "f" },
    });
    expect(pickMatch(album(), [single])).toMatchObject({ match: { id: "s" } });
  });

  it("sends a different year, or no exact title, to review", () => {
    expect(pickMatch(album(), [group({ year: 2005 })])).toEqual({
      kind: "review",
    });
    expect(pickMatch(album(), [group({ title: "Other" })])).toEqual({
      kind: "review",
    });
  });

  it("matches any year when the album has none", () => {
    expect(
      pickMatch(album({ year: null }), [group({ year: 2005 })]),
    ).toMatchObject({ kind: "match" });
  });
});

describe("applyMatch", () => {
  it("sets the cover, fills a missing year and clears the lookup", () => {
    const applied = applyMatch(
      album({ year: null, lookup: "review" }),
      group(),
    );
    expect(applied).toMatchObject({
      coverUrl: "https://coverartarchive.org/release-group/rg1/front-250",
      year: 1999,
      lookup: undefined,
    });
  });

  it("keeps the album's own year", () => {
    expect(applyMatch(album(), group({ year: 2005 })).year).toBe(1999);
  });
});

describe("lookup predicates", () => {
  it("tell albums to search, review and not found apart", () => {
    const cover = "https://example.com/c.jpg";
    expect(needsLookup(album())).toBe(true);
    expect(needsLookup(album({ coverUrl: cover }))).toBe(false);
    expect(needsLookup(album({ lookup: "skipped" }))).toBe(false);
    expect(awaitsReview(album({ lookup: "review" }))).toBe(true);
    expect(awaitsReview(album({ lookup: "review", coverUrl: cover }))).toBe(
      false,
    );
    expect(notFound(album({ lookup: "none" }))).toBe(true);
    expect(notFound(album())).toBe(false);
  });
});

describe("spotifySearchUrl", () => {
  it("searches Spotify for artist and title", () => {
    expect(spotifySearchUrl(album({ title: "A/B & C" }))).toBe(
      "https://open.spotify.com/search/Zeta%20Band%20A%2FB%20%26%20C",
    );
  });
});
