import { describe, expect, it } from "vitest";

import {
  albumIdentity,
  countByStatus,
  filterByStatus,
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

describe("albumIdentity", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(albumIdentity({ artist: " Émile ", title: "ALPHA", year: 1 })).toBe(
      albumIdentity({ artist: "emile", title: "alpha", year: 1 }),
    );
  });

  it("tells different years apart", () => {
    expect(albumIdentity({ artist: "a", title: "b", year: 1 })).not.toBe(
      albumIdentity({ artist: "a", title: "b", year: null }),
    );
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
