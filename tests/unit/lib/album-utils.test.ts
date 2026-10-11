import { describe, expect, it } from "vitest";

import {
  albumKey,
  countByStatus,
  filterByStatus,
  sameAlbum,
  sortAlbums,
} from "@/lib/album-utils";
import type { Album } from "@/lib/schemas";

function album(overrides: Partial<Album>): Album {
  return {
    id: overrides.title ?? "id",
    year: 2000,
    artist: "Artist",
    title: "Title",
    status: "toListen",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const albums = [
  album({ title: "Beta", artist: "Zed", year: 1990, status: "comingBack" }),
  album({
    title: "alpha",
    artist: "Émile",
    year: null,
    status: "notComingBack",
  }),
  album({ title: "Gamma", artist: "Abba", year: 1975 }),
  album({ title: "Delta", artist: "Abba", year: 1974 }),
];

const titles = (list: Album[]) => list.map((item) => item.title);

describe("albumKey", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(albumKey({ artist: " Émile ", title: "ALPHA" })).toBe(
      albumKey({ artist: "emile", title: "alpha" }),
    );
  });

  it("ignores punctuation, repeated spaces and a leading The", () => {
    expect(albumKey({ artist: "The Band", title: "Hello,  World!" })).toBe(
      albumKey({ artist: "band", title: "hello world" }),
    );
  });

  it("treats & as and", () => {
    expect(albumKey({ artist: "A & B", title: "T" })).toBe(
      albumKey({ artist: "A and B", title: "T" }),
    );
  });

  it("folds letters without an accent decomposition", () => {
    expect(albumKey({ artist: "Łódź", title: "T" })).toBe(
      albumKey({ artist: "lodz", title: "T" }),
    );
  });

  it("tells different titles apart", () => {
    expect(albumKey({ artist: "a", title: "b" })).not.toBe(
      albumKey({ artist: "a", title: "c" }),
    );
  });
});

describe("sameAlbum", () => {
  const base = { artist: "a", title: "b" };

  it("tells two known years apart", () => {
    expect(sameAlbum({ ...base, year: 1 }, { ...base, year: 2 })).toBe(false);
  });

  it("matches when either year is missing", () => {
    expect(sameAlbum({ ...base, year: 1 }, { ...base, year: null })).toBe(true);
    expect(sameAlbum({ ...base, year: null }, { ...base, year: 2 })).toBe(true);
  });

  it("never matches different albums", () => {
    expect(
      sameAlbum({ ...base, year: 1 }, { artist: "a", title: "c", year: 1 }),
    ).toBe(false);
  });
});

describe("filterByStatus / countByStatus", () => {
  it("returns everything for all", () => {
    expect(filterByStatus(albums, "all")).toBe(albums);
  });

  it("filters by one status", () => {
    expect(titles(filterByStatus(albums, "toListen"))).toEqual([
      "Gamma",
      "Delta",
    ]);
  });

  it("counts each status", () => {
    expect(countByStatus(albums)).toEqual({
      all: 4,
      toListen: 2,
      comingBack: 1,
      notComingBack: 1,
    });
  });
});

describe("sortAlbums", () => {
  it("sorts by year ascending with unknown years last", () => {
    expect(titles(sortAlbums(albums, "year", "asc"))).toEqual([
      "Delta",
      "Gamma",
      "Beta",
      "alpha",
    ]);
  });

  it("sorts by year descending", () => {
    expect(titles(sortAlbums(albums, "year", "desc"))).toEqual([
      "alpha",
      "Beta",
      "Gamma",
      "Delta",
    ]);
  });

  it("sorts by title ignoring case", () => {
    expect(titles(sortAlbums(albums, "title", "asc"))).toEqual([
      "alpha",
      "Beta",
      "Delta",
      "Gamma",
    ]);
  });

  it("sorts by artist, then by year within an artist", () => {
    expect(titles(sortAlbums(albums, "artist", "asc"))).toEqual([
      "Delta",
      "Gamma",
      "alpha",
      "Beta",
    ]);
  });

  it("breaks full ties with the remaining keys and keeps equal albums", () => {
    const twins = [album({ id: "1" }), album({ id: "2" })];
    expect(sortAlbums(twins, "title", "desc").map((item) => item.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("doesn't change the input", () => {
    const copy = [...albums];
    sortAlbums(albums, "title", "asc");
    expect(albums).toEqual(copy);
  });
});
