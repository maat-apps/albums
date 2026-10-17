import { describe, expect, it } from "vitest";

import { mergeAlbums, rebaseAlbums } from "@/lib/album-merge";
import type { Album } from "@/lib/schemas";

const EARLIER = "2026-10-01T10:00:00.000Z";
const LATER = "2026-10-02T10:00:00.000Z";

function album(overrides: Partial<Album> = {}): Album {
  return {
    id: "a1",
    year: 1977,
    artist: "Artist",
    title: "Title",
    status: "toListen",
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

const NONE = new Set<string>();

describe("mergeAlbums", () => {
  it("keeps albums that are the same on both sides as they are", () => {
    const result = mergeAlbums([album()], [album()], new Set(["a1"]));
    expect(result).toEqual({
      albums: [album()],
      added: 0,
      updated: 0,
      removed: 0,
    });
  });

  it("adds albums new in the file", () => {
    const result = mergeAlbums([], [album()], NONE);
    expect(result.albums).toEqual([album()]);
    expect(result.added).toBe(1);
  });

  it("keeps albums new on this device", () => {
    const result = mergeAlbums([album()], [], NONE);
    expect(result.albums).toEqual([album()]);
    expect(result.removed).toBe(0);
  });

  it("drops an album deleted here since the last sync", () => {
    const result = mergeAlbums([], [album()], new Set(["a1"]));
    expect(result.albums).toEqual([]);
    expect(result.added).toBe(0);
  });

  it("drops an album deleted in the file since the last sync", () => {
    const result = mergeAlbums([album()], [], new Set(["a1"]));
    expect(result.albums).toEqual([]);
    expect(result.removed).toBe(1);
  });

  it("keeps the newer edit of an album changed on both sides", () => {
    const local = album({ status: "comingBack", updatedAt: LATER });
    const remote = album({ status: "notComingBack" });

    const result = mergeAlbums([local], [remote], new Set(["a1"]));

    expect(result.albums).toEqual([local]);
    expect(result.updated).toBe(0);
  });

  it("takes the file's edit when it's newer", () => {
    const remote = album({ status: "comingBack", updatedAt: LATER });

    const result = mergeAlbums([album()], [remote], new Set(["a1"]));

    expect(result.albums).toEqual([remote]);
    expect(result.updated).toBe(1);
  });

  it("fills a cover, links and year the newer side lacks from the other", () => {
    const local = album({ year: null, status: "comingBack", updatedAt: LATER });
    const remote = album({
      coverUrl: "https://example.com/c.jpg",
      deezerUrl: "https://www.deezer.com/album/1",
    });

    const [merged] = mergeAlbums([local], [remote], new Set(["a1"])).albums;

    expect(merged).toEqual({
      ...local,
      year: 1977,
      coverUrl: "https://example.com/c.jpg",
      deezerUrl: "https://www.deezer.com/album/1",
    });
  });

  it("keeps this device's lookup verdicts when the file's edit wins", () => {
    const local = album({ lookup: "none", linksLookup: "done" });
    const remote = album({ status: "comingBack", updatedAt: LATER });

    const [merged] = mergeAlbums([local], [remote], new Set(["a1"])).albums;

    expect(merged).toEqual({ ...remote, lookup: "none", linksLookup: "done" });
  });

  it("matches a never-synced album under another id as the same one", () => {
    const local = album({ id: "local", artist: "The Artist", year: null });
    const remote = album({ id: "remote" });

    const result = mergeAlbums([local], [remote], NONE);

    expect(result.albums).toEqual([{ ...remote }]);
    expect(result).toMatchObject({ added: 0, updated: 1, removed: 0 });
  });

  it("pairs each file album with at most one album here", () => {
    const result = mergeAlbums(
      [album({ id: "l1" }), album({ id: "l2" })],
      [album({ id: "r1" })],
      NONE,
    );

    expect(result.albums.map((item) => item.id)).toEqual(["r1", "l2"]);
  });

  it("doesn't pair an already-synced album by artist and title", () => {
    const result = mergeAlbums(
      [album({ id: "l1" })],
      [album({ id: "r1" })],
      new Set(["l1"]),
    );

    expect(result.albums.map((item) => item.id)).toEqual(["r1"]);
    expect(result).toMatchObject({ added: 1, removed: 1 });
  });
});

describe("rebaseAlbums", () => {
  const a = album();
  const b = album({ id: "b1", artist: "B" });
  const remote = album({ id: "r1", artist: "Remote" });
  const merged = [a, b, remote];

  it("is the merge when nothing changed here", () => {
    expect(rebaseAlbums([a, b], [a, b], merged)).toEqual(merged);
  });

  it("keeps an album edited here meanwhile", () => {
    const edited = album({ status: "comingBack", updatedAt: LATER });
    expect(rebaseAlbums([a, b], [edited, b], merged)).toEqual([
      edited,
      b,
      remote,
    ]);
  });

  it("keeps an album deleted here meanwhile deleted", () => {
    expect(rebaseAlbums([a, b], [a], merged)).toEqual([a, remote]);
  });

  it("keeps an album added here meanwhile", () => {
    const added = album({ id: "n1", artist: "New" });
    expect(rebaseAlbums([a, b], [a, b, added], merged)).toEqual([
      ...merged,
      added,
    ]);
  });
});
