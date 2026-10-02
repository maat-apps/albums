import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlbumMatch } from "@/lib/cover-lookup";
import type { Album } from "@/lib/schemas";
import { resetIndexedDb } from "../reset-indexeddb";

const album = (id: string, overrides: Partial<Album> = {}): Album => ({
  id,
  year: 1999,
  artist: "Zeta Band",
  title: id,
  status: "toListen",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const group = (title: string, year = 1999): AlbumMatch => ({
  id: `rg-${title}`,
  title,
  artist: "Zeta Band",
  year,
  type: "album",
  coverUrl: `https://example.com/rg-${title}.jpg`,
  spotifyUrl: null,
});

async function fresh(albums: Album[]) {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  storage.replaceAllAlbums(albums);
  const runner = await import("@/lib/cover-lookup-runner");
  const { RateLimitedError } = await import("@/lib/musicbrainz");
  return { storage, runner, RateLimitedError };
}

const byId = (albums: Album[], id: string) =>
  albums.find((item) => item.id === id);

beforeEach(async () => {
  await resetIndexedDb();
});

describe("lookUpCovers", () => {
  it("fills sure matches, marks the rest, and skips albums with covers", async () => {
    const { storage, runner } = await fresh([
      album("sure"),
      album("unsure"),
      album("missing"),
      album("covered", { coverUrl: "https://example.com/c.jpg" }),
    ]);
    const search = vi.fn(async (item: Album) =>
      item.id === "sure"
        ? [group("sure")]
        : item.id === "unsure"
          ? [group("unsure", 2005)]
          : [],
    );
    const onProgress = vi.fn();

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: new AbortController().signal,
      onProgress,
      search,
      pause: 0,
    });

    expect(progress).toEqual({
      total: 3,
      done: 3,
      matched: 1,
      review: 1,
      notFound: 1,
    });
    expect(search).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledTimes(4);
    const albums = storage.getAlbumsSnapshot();
    expect(byId(albums, "sure")?.coverUrl).toContain("rg-sure");
    expect(byId(albums, "unsure")?.lookup).toBe("review");
    expect(byId(albums, "missing")?.lookup).toBe("none");
  });

  it("skips an album deleted or given a cover mid-run", async () => {
    const { storage, runner } = await fresh([album("a"), album("b")]);
    const search = vi.fn(async (item: Album) => {
      storage.deleteAlbum("b");
      return [group(item.id)];
    });

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      pause: 0,
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(progress).toMatchObject({ done: 2, matched: 1 });
  });

  it("stops when aborted, keeping what was found", async () => {
    const { storage, runner } = await fresh([album("a"), album("b")]);
    const controller = new AbortController();
    const search = vi.fn(async (item: Album) => {
      controller.abort();
      return [group(item.id)];
    });

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: controller.signal,
      onProgress: () => {},
      search,
      pause: 10_000,
    });

    expect(progress).toMatchObject({ done: 1, matched: 1 });
    expect(byId(storage.getAlbumsSnapshot(), "b")?.lookup).toBeUndefined();
  });

  it("wakes up from the pause between requests when aborted", async () => {
    const { runner } = await fresh([album("a"), album("b")]);
    const controller = new AbortController();
    const search = vi.fn(async (item: Album) => {
      setTimeout(() => controller.abort(), 10);
      return [group(item.id)];
    });

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: controller.signal,
      onProgress: () => {},
      search,
      pause: 60_000,
    });

    expect(progress.done).toBe(1);
  });

  it("resolves when a search is aborted mid-request", async () => {
    const { runner } = await fresh([album("a")]);
    const controller = new AbortController();
    const search = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    await expect(
      runner.lookUpCovers({
        source: "musicbrainz",
        signal: controller.signal,
        onProgress: () => {},
        search,
      }),
    ).resolves.toMatchObject({ done: 0 });
  });

  it("backs off and retries when rate limited", async () => {
    const { runner, RateLimitedError } = await fresh([album("a")]);
    const search = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError())
      .mockResolvedValueOnce([group("a")]);

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      pause: 0,
      backoff: 0,
    });

    expect(search).toHaveBeenCalledTimes(2);
    expect(progress.matched).toBe(1);
  });

  it("gives up after repeated rate limits, and on any other error", async () => {
    const { runner, RateLimitedError } = await fresh([album("a")]);
    const limited = vi.fn().mockRejectedValue(new RateLimitedError());
    await expect(
      runner.lookUpCovers({
        source: "musicbrainz",
        signal: new AbortController().signal,
        onProgress: () => {},
        search: limited,
        backoff: 0,
      }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(limited).toHaveBeenCalledTimes(4);

    const offline = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(
      runner.lookUpCovers({
        source: "musicbrainz",
        signal: new AbortController().signal,
        onProgress: () => {},
        search: offline,
      }),
    ).rejects.toThrow("offline");
  });

  it("uses MusicBrainz by default", async () => {
    const { runner } = await fresh([album("a")]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ "release-groups": [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const progress = await runner.lookUpCovers({
      source: "musicbrainz",
      signal: new AbortController().signal,
      onProgress: () => {},
      pause: 0,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(progress.notFound).toBe(1);
    vi.unstubAllGlobals();
  });

  it("records Spotify verdicts and looks up albums missing a link", async () => {
    const { storage, runner } = await fresh([
      album("linked", {
        coverUrl: "https://example.com/c.jpg",
        spotifyUrl: "https://open.spotify.com/album/x",
      }),
      album("covered", { coverUrl: "https://example.com/c.jpg" }),
    ]);
    const search = vi.fn().mockResolvedValue([]);

    const progress = await runner.lookUpCovers({
      source: "spotify",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      pause: 0,
    });

    expect(progress).toMatchObject({ total: 1, notFound: 1 });
    expect(byId(storage.getAlbumsSnapshot(), "covered")?.spotifyLookup).toBe(
      "none",
    );
  });

  it("waits as long as the service asks after a rate limit", async () => {
    const { runner, RateLimitedError } = await fresh([album("a")]);
    const search = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError(60))
      .mockResolvedValueOnce([group("a")]);
    const started = Date.now();

    const progress = await runner.lookUpCovers({
      source: "spotify",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      backoff: 0,
    });

    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(progress.matched).toBe(1);
  });
});
