import { describe, expect, it } from "vitest";

import { CsvImportError, importAlbumsFromCsv } from "@/lib/csv-import";
import type { Album } from "@/lib/schemas";

// Made-up rows only — no personal list is ever committed to this repo.
const NOW = new Date("2026-10-01T10:00:00.000Z");
const HEADER = "Rok,Artysta,Tytuł,WRACAM?";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
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

  it("skips albums already in the collection or repeated in the file", () => {
    const existing = [
      { artist: "Artist A", title: "Album A", year: 1999 },
    ] as Album[];

    const result = importAlbumsFromCsv(
      csv(
        "1999,artist a,ALBUM A,GREEN",
        "2000,Artist B,Album B,",
        "2000,Artist B,Album B,RED",
      ),
      existing,
    );

    expect(result.albums.map((album) => album.artist)).toEqual(["Artist B"]);
    expect(result.skipped).toBe(2);
  });

  it("counts rows without artist or title, or with an unknown status, as invalid", () => {
    const result = importAlbumsFromCsv(
      csv("1999,,Album,", "1999,Artist,,", "1999,Artist,Album,BLUE"),
      [],
    );
    expect(result).toEqual({ albums: [], skipped: 0, invalid: 3 });
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
