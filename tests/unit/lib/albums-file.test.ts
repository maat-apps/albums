import { describe, expect, it } from "vitest";

import {
  AlbumsFileError,
  formatAlbumsFile,
  parseAlbumsFile,
} from "@/lib/albums-file";
import type { Album } from "@/lib/schemas";

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "a1",
    year: 1977,
    artist: "Artist",
    title: "Title",
    status: "toListen",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("formatAlbumsFile", () => {
  it("writes the albums sorted by artist, year (none last) and title", () => {
    const text = formatAlbumsFile([
      album({ id: "3", artist: "Ąbba", year: null, title: "Z" }),
      album({ id: "2", artist: "abba", year: 1980, title: "B" }),
      album({ id: "1", artist: "Abba", year: 1980, title: "A" }),
      album({ id: "4", artist: "Bee", year: 1970 }),
    ]);

    expect((JSON.parse(text) as Album[]).map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("keeps the file's field order, two-space indent and final newline", () => {
    const text = formatAlbumsFile([
      album({
        updatedAt: "2026-10-02T00:00:00.000Z",
        deezerUrl: "https://www.deezer.com/album/1",
        coverUrl: "https://example.com/c.jpg",
      }),
    ]);

    expect(text).toBe(
      `${JSON.stringify(
        [
          {
            id: "a1",
            year: 1977,
            artist: "Artist",
            title: "Title",
            status: "toListen",
            coverUrl: "https://example.com/c.jpg",
            deezerUrl: "https://www.deezer.com/album/1",
            createdAt: "2026-10-01T10:00:00.000Z",
            updatedAt: "2026-10-02T00:00:00.000Z",
          },
        ],
        null,
        2,
      )}\n`,
    );
  });

  it("leaves this device's lookup verdicts out", () => {
    const text = formatAlbumsFile([
      album({ lookup: "none", linksLookup: "done", itunesLookup: "skipped" }),
    ]);

    expect(text).not.toMatch(/lookup/i);
  });
});

describe("parseAlbumsFile", () => {
  it("reads back what formatAlbumsFile wrote", () => {
    const albums = [album(), album({ id: "a2", artist: "Other" })];
    expect(parseAlbumsFile(formatAlbumsFile(albums))).toEqual(albums);
  });

  it("rejects text that isn't JSON", () => {
    expect(() => parseAlbumsFile("{nope")).toThrow(AlbumsFileError);
  });

  it("rejects JSON that isn't a list", () => {
    expect(() => parseAlbumsFile('{"albums":[]}')).toThrow(AlbumsFileError);
  });

  it("rejects a file with an album it can't read", () => {
    const text = JSON.stringify([album(), { title: "No id" }]);
    expect(() => parseAlbumsFile(text)).toThrow(/1 albums/);
  });
});
