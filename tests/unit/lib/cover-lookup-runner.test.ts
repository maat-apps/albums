import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  links: {},
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
  // A match's Deezer link is fetched unless a test injects findLink.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ releases: [] }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookUpCovers", () => {
  it("fills sure matches, marks the rest, and skips albums with covers", async () => {
    const { storage, runner } = await fresh([
      album("sure"),
      album("unsure"),
      album("missing"),
      album("covered", {
        coverUrl: "https://example.com/c.jpg",
        deezerUrl: "https://www.deezer.com/album/1",
      }),
    ]);
    const search = vi.fn(async (item: Album) =>
      item.id === "sure"
        ? [group("sure")]
        : item.id === "unsure"
          ? [{ ...group("unsure"), artist: "Someone Else" }]
          : [],
    );
    const onProgress = vi.fn();

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz"],
      service: "deezer",
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

  it("tries the next source for what the first didn't match", async () => {
    const { storage, runner } = await fresh([
      album("first"),
      album("second"),
      album("neither"),
    ]);
    const search = vi.fn(async (item: Album) => {
      // Called once per source, in order, for albums not yet matched.
      const calls = search.mock.calls.filter(([a]) => a.id === item.id).length;
      return item.id === "first" || (item.id === "second" && calls === 2)
        ? [group(item.id)]
        : [];
    });

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      pause: 0,
    });

    expect(progress).toMatchObject({ matched: 2, notFound: 1 });
    expect(search).toHaveBeenCalledTimes(5);
    const albums = storage.getAlbumsSnapshot();
    expect(byId(albums, "second")?.coverUrl).toContain("rg-second");
    expect(byId(albums, "second")?.lookup).toBeUndefined();
    expect(byId(albums, "neither")).toMatchObject({
      lookup: "none",
      itunesLookup: "none",
    });
  });

  it("fetches the Deezer link of a MusicBrainz match", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const findLink = vi.fn(async () => ({
      deezer: "https://www.deezer.com/album/7",
    }));

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search: async () => [group("a")],
      findLink,
      pause: 0,
    });

    expect(progress.matched).toBe(1);
    expect(findLink).toHaveBeenCalledWith("rg-a", expect.any(AbortSignal));
    expect(byId(storage.getAlbumsSnapshot(), "a")).toMatchObject({
      coverUrl: "https://example.com/rg-a.jpg",
      deezerUrl: "https://www.deezer.com/album/7",
    });
  });

  it("looks a link up for an album with a cover, and remembers they were read", async () => {
    const { storage, runner } = await fresh([
      album("a", { coverUrl: "https://example.com/own.jpg" }),
    ]);
    const search = vi.fn(async () => [group("a")]);

    await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      findLink: async () => ({}),
      pause: 0,
    });

    expect(search).toHaveBeenCalledOnce();
    expect(byId(storage.getAlbumsSnapshot(), "a")).toMatchObject({
      coverUrl: "https://example.com/own.jpg",
      linksLookup: "done",
    });
  });

  it("asks again next time when the link can't be fetched", async () => {
    const { storage, runner } = await fresh([album("a")]);

    await runner.lookUpCovers({
      sources: ["musicbrainz"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search: async () => [group("a")],
      findLink: async () => {
        throw new TypeError("offline");
      },
      pause: 0,
    });

    const saved = byId(storage.getAlbumsSnapshot(), "a");
    expect(saved?.coverUrl).toContain("rg-a");
    expect(saved?.linksLookup).toBeUndefined();
  });

  it("asks the next source for what a match left missing", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const search = vi.fn(async () =>
      search.mock.calls.length === 1
        ? [{ ...group("a"), coverUrl: null }]
        : [group("a")],
    );

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      findLink: async () => ({ deezer: "https://www.deezer.com/album/7" }),
      pause: 0,
    });

    expect(search).toHaveBeenCalledTimes(2);
    expect(progress.matched).toBe(1);
    expect(byId(storage.getAlbumsSnapshot(), "a")).toMatchObject({
      coverUrl: "https://example.com/rg-a.jpg",
      deezerUrl: "https://www.deezer.com/album/7",
    });
  });

  it("keeps a cover found before the run stops mid-album", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const controller = new AbortController();

    await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: controller.signal,
      onProgress: () => {},
      search: async () => [{ ...group("a"), coverUrl: null }],
      findLink: async () => {
        controller.abort();
        return {};
      },
      pause: 0,
    });

    expect(byId(storage.getAlbumsSnapshot(), "a")?.linksLookup).toBe("done");
  });

  it("leaves out a source that fails, and goes on with the others", async () => {
    const { storage, runner } = await fresh([
      album("a"),
      album("b"),
      album("linkless", { coverUrl: "https://example.com/own.jpg" }),
    ]);
    // MusicBrainz (the first call) is unreachable; iTunes finds the rest.
    const search = vi.fn(async (item: Album) => {
      if (search.mock.calls.length === 1) throw new TypeError("offline");
      return [group(item.id)];
    });

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz", "itunes"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      pause: 0,
    });

    // MusicBrainz once, then iTunes for "a" and "b"; "linkless" only needed
    // MusicBrainz (for its link), so it's left for the next run.
    expect(search).toHaveBeenCalledTimes(3);
    expect(progress).toEqual({
      total: 3,
      done: 3,
      matched: 2,
      review: 0,
      notFound: 0,
    });
    const albums = storage.getAlbumsSnapshot();
    expect(byId(albums, "b")?.coverUrl).toContain("rg-b");
    expect(byId(albums, "linkless")?.linksLookup).toBeUndefined();
  });

  it("rejects once every source has failed", async () => {
    const { runner } = await fresh([album("a"), album("b")]);
    const search = vi.fn().mockRejectedValue(new TypeError("offline"));

    await expect(
      runner.lookUpCovers({
        sources: ["musicbrainz", "itunes"],
        service: "deezer",
        signal: new AbortController().signal,
        onProgress: () => {},
        search,
        pause: 0,
      }),
    ).rejects.toThrow("offline");
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("skips an album deleted or given a cover mid-run", async () => {
    const { storage, runner } = await fresh([album("a"), album("b")]);
    const search = vi.fn(async (item: Album) => {
      storage.deleteAlbum("b");
      return [group(item.id)];
    });

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz"],
      service: "deezer",
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
      sources: ["musicbrainz"],
      service: "deezer",
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
      sources: ["musicbrainz"],
      service: "deezer",
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
        sources: ["musicbrainz"],
        service: "deezer",
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
      sources: ["musicbrainz"],
      service: "deezer",
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
        sources: ["musicbrainz"],
        service: "deezer",
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
        sources: ["musicbrainz"],
        service: "deezer",
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
      sources: ["musicbrainz"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      pause: 0,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(progress.notFound).toBe(1);
    vi.unstubAllGlobals();
  });

  it("waits as long as the service asks after a rate limit", async () => {
    const { runner, RateLimitedError } = await fresh([album("a")]);
    const search = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitedError(60))
      .mockResolvedValueOnce([group("a")]);
    const started = Date.now();

    const progress = await runner.lookUpCovers({
      sources: ["musicbrainz"],
      service: "deezer",
      signal: new AbortController().signal,
      onProgress: () => {},
      search,
      backoff: 0,
    });

    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(progress.matched).toBe(1);
  });
});

describe("lookUpAlbumNow", () => {
  const releaseGroups = {
    "release-groups": [
      {
        id: "rg7",
        title: "a",
        "first-release-date": "1999-01-01",
        "primary-type": "Album",
        "artist-credit": [{ name: "Zeta Band" }],
      },
    ],
  };
  const releases = {
    releases: [
      {
        relations: [{ url: { resource: "https://www.deezer.com/en/album/7" } }],
      },
    ],
  };
  const json = (body: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
  const answer = (url: string) =>
    json(url.includes("/release-group/") ? releaseGroups : releases);

  it("fills the album's cover and Deezer link from MusicBrainz", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const fetchMock = vi.fn(async (url: string) => answer(url));
    vi.stubGlobal("fetch", fetchMock);

    await runner.lookUpAlbumNow("a", "deezer", new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(byId(storage.getAlbumsSnapshot(), "a")).toMatchObject({
      coverUrl: "https://coverartarchive.org/release-group/rg7/front-1200",
      deezerUrl: "https://www.deezer.com/album/7",
    });
  });

  it("doesn't search an album with nothing left to find, or a missing one", async () => {
    const { runner } = await fresh([
      album("done", {
        coverUrl: "https://example.com/c.jpg",
        deezerUrl: "https://www.deezer.com/album/1",
      }),
      album("tried", { lookup: "none", itunesLookup: "none" }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const id of ["done", "tried", "gone"]) {
      await runner.lookUpAlbumNow(id, "deezer", new AbortController().signal);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an edit made while it searched", async () => {
    const { storage, runner } = await fresh([album("a")]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        storage.saveAlbum({ ...album("a"), title: "Renamed" });
        return answer(url);
      }),
    );

    await runner.lookUpAlbumNow("a", "deezer", new AbortController().signal);

    const saved = byId(storage.getAlbumsSnapshot(), "a");
    expect(saved?.title).toBe("Renamed");
    expect(saved?.coverUrl).toBeUndefined();
  });

  it("doesn't wait out a rate limit, leaving the album for next time", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    await runner.lookUpAlbumNow("a", "deezer", new AbortController().signal);

    // MusicBrainz once, then iTunes once; neither tried again.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(byId(storage.getAlbumsSnapshot(), "a")?.lookup).toBeUndefined();
  });

  it("saves nothing when stopped before searching", async () => {
    const { storage, runner } = await fresh([album("a")]);
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn());

    await runner.lookUpAlbumNow("a", "deezer", controller.signal);

    expect(byId(storage.getAlbumsSnapshot(), "a")?.lookup).toBeUndefined();
  });
});
