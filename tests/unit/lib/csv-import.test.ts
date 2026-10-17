import { describe, expect, it } from "vitest";

import { CsvImportError, importAlbumsFromCsv } from "@/lib/csv-import";
import type { Album } from "@/lib/schemas";

// Made-up rows only — no personal list is ever committed to this repo.
const NOW = new Date("2026-10-01T10:00:00.000Z");
const HEADER = "Rok,Artysta,Tytuł,WRACAM?";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function album(overrides: Partial<Album>): Album {
  return {
    id: "existing",
    year: 1999,
    artist: "Artist A",
    title: "Album A",
    status: "toListen",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("importAlbumsFromCsv", () => {
  it("maps columns and statuses", () => {
    const { albums } = importAlbumsFromCsv(
      csv(
        "1999,Artist A,Album A,GREEN",
        "2000,Artist B,Album B,RED",
        "2001,Artist C,Album C,",
      ),
      [],
      NOW,
    );

    expect(
      albums.map(({ artist, title, year, status }) => ({
        artist,
        title,
        year,
        status,
      })),
    ).toEqual([
      {
        artist: "Artist A",
        title: "Album A",
        year: 1999,
        status: "comingBack",
      },
      {
        artist: "Artist B",
        title: "Album B",
        year: 2000,
        status: "notComingBack",
      },
      { artist: "Artist C", title: "Album C", year: 2001, status: "toListen" },
    ]);
    expect(albums[0]).toMatchObject({
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("trims values and accepts lowercase statuses", () => {
    const { albums } = importAlbumsFromCsv(
      csv(" 1999 , Artist A  ,  Album A , green "),
      [],
    );
    expect(albums[0]).toMatchObject({
      year: 1999,
      artist: "Artist A",
      title: "Album A",
      status: "comingBack",
    });
  });

  it("reads quoted titles with commas and quotes", () => {
    const { albums } = importAlbumsFromCsv(
      csv('2015,Artist,"""Awake, Now!""",GREEN'),
      [],
    );
    expect(albums[0]?.title).toBe('"Awake, Now!"');
  });

  it("accepts columns in any order and English names", () => {
    const { albums } = importAlbumsFromCsv(
      "Title,Artist,Year\nAlbum A,Artist A,1999",
      [],
    );
    expect(albums[0]).toMatchObject({
      title: "Album A",
      artist: "Artist A",
      year: 1999,
      status: "toListen",
    });
  });

  it("keeps an album with a missing or odd year, without one", () => {
    const { albums } = importAlbumsFromCsv(
      csv(",Artist,Album,", "199x,Other,Album,"),
      [],
    );
    expect(albums.map((album) => album.year)).toEqual([null, null]);
  });

  it("skips an unchanged album and a row repeated in the file", () => {
    const existing = [album({ artist: "Artist A", title: "Album A" })];

    const result = importAlbumsFromCsv(
      csv(
        "1999,artist a,ALBUM A,",
        "2000,Artist B,Album B,",
        "2000,Artist B,Album B,RED",
      ),
      existing,
    );

    expect(result.albums.map((item) => item.artist)).toEqual(["Artist B"]);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toBe(2);
  });

  it("updates the status of an existing album, keeping the rest", () => {
    const existing = [
      album({
        artist: "Artist A",
        title: "Album A",
        coverUrl: "https://x.y/c",
      }),
    ];

    const result = importAlbumsFromCsv(
      csv("1999,Artist A,Album A,GREEN"),
      existing,
      NOW,
    );

    expect(result.albums).toEqual([]);
    expect(result.updated).toEqual([
      {
        ...existing[0],
        status: "comingBack",
        updatedAt: NOW.toISOString(),
      },
    ]);
    expect(result.skipped).toBe(0);
  });

  it("skips an existing album whose status already matches", () => {
    const existing = [album({ status: "comingBack" })];

    const result = importAlbumsFromCsv(
      csv("1999,Artist A,Album A,green"),
      existing,
    );

    expect(result).toMatchObject({ updated: [], skipped: 1 });
  });

  it("never overrides a status with an empty cell or a missing column", () => {
    const existing = [album({ status: "notComingBack" })];

    const blank = importAlbumsFromCsv(csv("1999,Artist A,Album A,"), existing);
    const noColumn = importAlbumsFromCsv(
      "Rok,Artysta,Tytuł\n1999,Artist A,Album A",
      existing,
    );

    expect(blank.updated).toEqual([]);
    expect(noColumn.updated).toEqual([]);
  });

  it("applies the first of two rows for the same existing album", () => {
    const result = importAlbumsFromCsv(
      csv("1999,Artist A,Album A,GREEN", "1999,Artist A,Album A,RED"),
      [album({})],
    );

    expect(result.updated.map((item) => item.status)).toEqual(["comingBack"]);
    expect(result.skipped).toBe(1);
  });

  it("matches despite punctuation, a leading The or a missing year", () => {
    const existing = [
      album({ artist: "The Band", title: "Hello, World!", year: 1999 }),
    ];

    const result = importAlbumsFromCsv(csv(",band,hello world,RED"), existing);

    expect(result.albums).toEqual([]);
    expect(result.updated).toHaveLength(1);
  });

  it("prefers the existing album with the same year", () => {
    const existing = [
      album({ id: "old", year: 1990 }),
      album({ id: "new", year: 1999 }),
    ];

    const result = importAlbumsFromCsv(
      csv("1999,Artist A,Album A,RED"),
      existing,
    );

    expect(result.updated.map((item) => item.id)).toEqual(["new"]);
  });

  it("adds a different year of the same title as a new album", () => {
    const result = importAlbumsFromCsv(csv("2010,Artist A,Album A,"), [
      album({}),
    ]);

    expect(result.albums).toHaveLength(1);
  });

  it("counts rows without artist or title, or with an unknown status, as invalid", () => {
    const result = importAlbumsFromCsv(
      csv("1999,,Album,", "1999,Artist,,", "1999,Artist,Album,BLUE"),
      [],
    );
    expect(result).toEqual({
      albums: [],
      updated: [],
      skipped: 0,
      invalid: 3,
    });
  });

  it("reads a short row's missing cells as empty", () => {
    const { albums } = importAlbumsFromCsv(csv("1999,Artist,Album"), []);
    expect(albums[0]?.status).toBe("toListen");
  });

  it("rejects a file without artist and title columns", () => {
    expect(() => importAlbumsFromCsv("a,b\n1,2", [])).toThrow(CsvImportError);
    expect(() => importAlbumsFromCsv("", [])).toThrow(CsvImportError);
  });
});
