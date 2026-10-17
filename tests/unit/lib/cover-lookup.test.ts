import { describe, expect, it } from "vitest";

import {
  applyMatch,
  awaitsReview,
  editDistance,
  needsLookup,
  normalize,
  notFound,
  pickMatch,
  wantsLinks,
  withVerdict,
  type AlbumMatch,
} from "@/lib/cover-lookup";
import type { Album } from "@/lib/schemas";

const COVER = "https://example.com/c.jpg";
const DEEZER = "https://www.deezer.com/album/302127";

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
  links: {},
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

describe("editDistance", () => {
  it("counts single-letter edits", () => {
    expect(editDistance("manoeuvres", "manouvres")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });
});

describe("pickMatch with a misspelt artist", () => {
  const omd = "Orchestral Manoeuvres in the Dark";

  it("matches an artist one or two typos away", () => {
    expect(
      pickMatch(album({ artist: "Orchestral Manouvres In The Dark" }), [
        match({ artist: omd }),
      ]),
    ).toMatchObject({ kind: "match" });
  });

  it("keeps short names exact, and prefers the exact artist", () => {
    expect(
      pickMatch(album({ artist: "Blur" }), [match({ artist: "Blue" })]),
    ).toEqual({ kind: "review" });
    expect(
      pickMatch(album({ artist: "Queen" }), [match({ artist: "Queer" })]),
    ).toMatchObject({ kind: "match" });
    const exact = match({ id: "exact", artist: "Zeta Band" });
    expect(
      pickMatch(album(), [match({ id: "typo", artist: "Zeta Bend" }), exact]),
    ).toEqual({ kind: "match", match: exact });
  });

  it("sends a farther artist to review", () => {
    expect(
      pickMatch(album({ artist: "Zeta Band" }), [
        match({ artist: "Beta Bond" }),
      ]),
    ).toEqual({ kind: "review" });
  });
});

describe("applyMatch", () => {
  it("fills a missing cover and year, and clears the verdicts", () => {
    const applied = applyMatch(
      album({ year: null, lookup: "review", itunesLookup: "none" }),
      match(),
    );
    expect(applied).toMatchObject({
      coverUrl: COVER,
      year: 1999,
      lookup: undefined,
      itunesLookup: undefined,
    });
  });

  it("keeps what the album already has", () => {
    const own = album({ coverUrl: "https://example.com/own.jpg" });
    const applied = applyMatch(own, match({ year: 2005 }));
    expect(applied).toMatchObject({ coverUrl: own.coverUrl, year: 1999 });
  });

  it("leaves a cover the match doesn't have unset", () => {
    const applied = applyMatch(album(), match({ coverUrl: null }));
    expect(applied.coverUrl).toBeUndefined();
  });

  it("fills the links the album is missing, keeping its own", () => {
    const own = "https://www.deezer.com/album/1";
    const applied = applyMatch(
      album({ deezerUrl: own, linksLookup: "done" }),
      match({
        links: {
          deezer: DEEZER,
          appleMusic: "https://music.apple.com/us/album/9",
        },
      }),
    );
    expect(applied).toMatchObject({
      deezerUrl: own,
      appleMusicUrl: "https://music.apple.com/us/album/9",
      linksLookup: "done",
    });
  });
});

describe("lookup predicates", () => {
  it("track MusicBrainz verdicts for albums without a cover", () => {
    expect(needsLookup(album(), "musicbrainz", "deezer")).toBe(true);
    expect(
      needsLookup(
        album({ coverUrl: COVER, deezerUrl: DEEZER }),
        "musicbrainz",
        "deezer",
      ),
    ).toBe(false);
    expect(
      needsLookup(album({ lookup: "skipped" }), "musicbrainz", "deezer"),
    ).toBe(false);
    expect(awaitsReview(album({ lookup: "review" }), "musicbrainz")).toBe(true);
    expect(notFound(album({ lookup: "none" }), "musicbrainz")).toBe(true);
    expect(notFound(album(), "musicbrainz")).toBe(false);
  });

  it("look a year up on MusicBrainz for an album that has a cover", () => {
    const covered = album({ coverUrl: COVER, year: null });
    expect(needsLookup(covered, "musicbrainz", "deezer")).toBe(true);
    expect(needsLookup(covered, "itunes", "deezer")).toBe(false);
  });

  it("record a verdict for its source", () => {
    expect(withVerdict(album(), "musicbrainz", "none").lookup).toBe("none");
    expect(withVerdict(album(), "itunes", "none").itunesLookup).toBe("none");
  });
});

describe("iTunes lookup predicates", () => {
  it("need a cover, and ignore other sources' verdicts", () => {
    expect(needsLookup(album({ lookup: "none" }), "itunes", "deezer")).toBe(
      true,
    );
    expect(
      needsLookup(album({ itunesLookup: "none" }), "itunes", "deezer"),
    ).toBe(false);
    expect(needsLookup(album({ coverUrl: COVER }), "itunes", "deezer")).toBe(
      false,
    );
  });
});

describe("streaming link predicates", () => {
  it("want the service's link until it's found or the links were read", () => {
    expect(wantsLinks(album(), "deezer")).toBe(true);
    expect(wantsLinks(album({ deezerUrl: DEEZER }), "deezer")).toBe(false);
    expect(wantsLinks(album({ deezerUrl: DEEZER }), "spotify")).toBe(true);
    expect(wantsLinks(album({ linksLookup: "done" }), "spotify")).toBe(false);
  });

  it("look a link up on MusicBrainz for an album that has a cover", () => {
    const covered = album({ coverUrl: COVER });
    expect(needsLookup(covered, "musicbrainz", "deezer")).toBe(true);
    expect(needsLookup(covered, "itunes", "deezer")).toBe(false);
    expect(
      needsLookup(
        album({ coverUrl: COVER, linksLookup: "done" }),
        "musicbrainz",
        "deezer",
      ),
    ).toBe(false);
  });

  it("look an Apple Music link up on iTunes too", () => {
    const covered = album({ coverUrl: COVER, linksLookup: "done" });
    expect(needsLookup(covered, "itunes", "appleMusic")).toBe(true);
    expect(
      needsLookup(
        { ...covered, appleMusicUrl: "https://music.apple.com/us/album/9" },
        "itunes",
        "appleMusic",
      ),
    ).toBe(false);
  });

  it("list only albums without a cover to review or as not found", () => {
    const covered = album({ coverUrl: COVER, lookup: "review" });
    expect(awaitsReview(covered, "musicbrainz", "deezer")).toBe(false);
    expect(
      notFound(album({ coverUrl: COVER, lookup: "none" }), "musicbrainz"),
    ).toBe(false);
  });
});
