import { describe, expect, it } from "vitest";

import {
  applyMatch,
  awaitsReview,
  needsLookup,
  normalize,
  notFound,
  pickMatch,
  spotifySearchUrl,
  withVerdict,
  type AlbumMatch,
} from "@/lib/cover-lookup";
import type { Album } from "@/lib/schemas";

const COVER = "https://example.com/c.jpg";
const LINK = "https://open.spotify.com/album/x";

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

const match = (overrides: Partial<AlbumMatch> = {}): AlbumMatch => ({
  id: "m1",
  title: "Made-up Title",
  artist: "Zeta Band",
  year: 1999,
  type: "album",
  coverUrl: COVER,
  spotifyUrl: null,
  ...overrides,
});

describe("normalize", () => {
  it("ignores case, diacritics, punctuation, brackets and a leading 'the'", () => {
    expect(normalize("The Żółć & Co. (Remastered) [Deluxe]")).toBe(
      "zołc and co",
    );
    expect(normalize("  Kid-A! ")).toBe("kid a");
  });

  it("drops trailing edition words, with their year", () => {
    expect(normalize("Abbey Road - 2019 Remaster")).toBe("abbey road");
    expect(normalize("Nevermind: Deluxe Edition")).toBe("nevermind");
    expect(normalize("Rumours (Super Deluxe)")).toBe("rumours");
  });

  it("keeps a title that is only a number or edition word", () => {
    expect(normalize("1989")).toBe("1989");
    expect(normalize("Deluxe")).toBe("deluxe");
  });
});

describe("pickMatch", () => {
  it("is none without results", () => {
    expect(pickMatch(album(), [])).toEqual({ kind: "none" });
  });

  it("matches the same artist, title and year", () => {
    const sure = match({ title: "made up title (2009 Remaster)" });
    expect(pickMatch(album(), [match({ artist: "Other" }), sure])).toEqual({
      kind: "match",
      match: sure,
    });
  });

  it("prefers an album over a single of the same name", () => {
    const single = match({ id: "s", type: "single" });
    const full = match({ id: "f" });
    expect(pickMatch(album(), [single, full])).toMatchObject({
      match: { id: "f" },
    });
    expect(pickMatch(album(), [single])).toMatchObject({ match: { id: "s" } });
  });

  it("matches a different year too", () => {
    expect(pickMatch(album(), [match({ year: 2005 })])).toMatchObject({
      kind: "match",
    });
  });

  it("matches an edition of the album", () => {
    expect(
      pickMatch(album(), [match({ title: "Made-up Title - Deluxe Edition" })]),
    ).toMatchObject({ kind: "match" });
  });

  it("prefers the album's year, then a plain release, over the first found", () => {
    const deluxe = match({ id: "d", title: "Made-up Title (Deluxe)" });
    const plain = match({ id: "p" });
    const reissue = match({ id: "r", year: 2015 });
    expect(pickMatch(album(), [deluxe, plain])).toMatchObject({
      match: { id: "p" },
    });
    expect(pickMatch(album(), [reissue, deluxe])).toMatchObject({
      match: { id: "d" },
    });
    expect(pickMatch(album(), [reissue, plain])).toMatchObject({
      match: { id: "p" },
    });
  });

  it("takes the first of equally good matches", () => {
    expect(
      pickMatch(album(), [match({ id: "x" }), match({ id: "y" })]),
    ).toMatchObject({ match: { id: "x" } });
  });

  it("sends results of another title or artist to review", () => {
    expect(pickMatch(album(), [match({ title: "Other" })])).toEqual({
      kind: "review",
    });
    expect(pickMatch(album(), [match({ artist: "Other" })])).toEqual({
      kind: "review",
    });
  });

  it("matches any year when the album has none", () => {
    expect(
      pickMatch(album({ year: null }), [match({ year: 2005 })]),
    ).toMatchObject({ kind: "match" });
  });
});

describe("applyMatch", () => {
  it("fills a missing cover, link and year, and clears the verdicts", () => {
    const applied = applyMatch(
      album({
        year: null,
        lookup: "review",
        spotifyLookup: "none",
        itunesLookup: "none",
      }),
      match({ spotifyUrl: LINK }),
    );
    expect(applied).toMatchObject({
      coverUrl: COVER,
      spotifyUrl: LINK,
      year: 1999,
      lookup: undefined,
      spotifyLookup: undefined,
      itunesLookup: undefined,
    });
  });

  it("keeps what the album already has", () => {
    const own = album({
      coverUrl: "https://example.com/own.jpg",
      spotifyUrl: LINK,
    });
    const applied = applyMatch(
      own,
      match({ year: 2005, spotifyUrl: "https://open.spotify.com/album/y" }),
    );
    expect(applied).toMatchObject({
      coverUrl: own.coverUrl,
      spotifyUrl: LINK,
      year: 1999,
    });
  });

  it("leaves a cover or link the match doesn't have unset", () => {
    const applied = applyMatch(album(), match({ coverUrl: null }));
    expect(applied.coverUrl).toBeUndefined();
    expect(applied.spotifyUrl).toBeUndefined();
  });
});

describe("lookup predicates", () => {
  it("track MusicBrainz verdicts for albums without a cover", () => {
    expect(needsLookup(album(), "musicbrainz")).toBe(true);
    expect(needsLookup(album({ coverUrl: COVER }), "musicbrainz")).toBe(false);
    expect(needsLookup(album({ lookup: "skipped" }), "musicbrainz")).toBe(
      false,
    );
    expect(awaitsReview(album({ lookup: "review" }), "musicbrainz")).toBe(true);
    expect(notFound(album({ lookup: "none" }), "musicbrainz")).toBe(true);
    expect(notFound(album(), "musicbrainz")).toBe(false);
  });

  it("track Spotify verdicts for albums without a cover or a link", () => {
    expect(needsLookup(album({ coverUrl: COVER }), "spotify")).toBe(true);
    expect(
      needsLookup(album({ coverUrl: COVER, spotifyUrl: LINK }), "spotify"),
    ).toBe(false);
    // A MusicBrainz verdict doesn't stop a Spotify lookup.
    expect(needsLookup(album({ lookup: "none" }), "spotify")).toBe(true);
    expect(awaitsReview(album({ spotifyLookup: "review" }), "spotify")).toBe(
      true,
    );
    expect(notFound(album({ spotifyLookup: "none" }), "spotify")).toBe(true);
  });

  it("record a verdict for its source", () => {
    expect(withVerdict(album(), "musicbrainz", "none").lookup).toBe("none");
    expect(withVerdict(album(), "spotify", "skipped").spotifyLookup).toBe(
      "skipped",
    );
    expect(withVerdict(album(), "itunes", "none").itunesLookup).toBe("none");
  });
});

describe("iTunes lookup predicates", () => {
  it("need a cover, and ignore other sources' verdicts", () => {
    expect(needsLookup(album({ lookup: "none" }), "itunes")).toBe(true);
    expect(needsLookup(album({ itunesLookup: "none" }), "itunes")).toBe(false);
    expect(needsLookup(album({ coverUrl: COVER }), "itunes")).toBe(false);
  });
});

describe("spotifySearchUrl", () => {
  it("searches Spotify for artist and title", () => {
    expect(spotifySearchUrl(album({ title: "A/B & C" }))).toBe(
      "https://open.spotify.com/search/Zeta%20Band%20A%2FB%20%26%20C",
    );
  });
});
