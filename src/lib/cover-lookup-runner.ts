import {
  applyMatch,
  needsLookup,
  pickMatch,
  withVerdict,
  type AlbumMatch,
  type LookupSource,
} from "./cover-lookup";
import { searchItunes } from "./itunes";
import { RateLimitedError, searchMusicBrainz } from "./musicbrainz";
import type { Album } from "./schemas";
import { searchSpotify } from "./spotify-api";
import { getAlbumsSnapshot, saveAlbum } from "./storage";

// Looks every album missing something up — on Spotify when it's connected
// (cover, link, year; fast), otherwise on MusicBrainz (cover, year; one
// request a second, so a 1000-album CSV takes about 20 minutes) — and
// then, for what that didn't match, on iTunes. Stopping keeps everything
// found so far: each album is saved as it's done, and the next run skips it.

export type LookupProgress = {
  total: number;
  done: number;
  matched: number;
  review: number;
  notFound: number;
};

type Search = (
  album: Pick<Album, "artist" | "title">,
  signal: AbortSignal,
) => Promise<AlbumMatch[]>;

export const SEARCHES: Record<LookupSource, Search> = {
  musicbrainz: searchMusicBrainz,
  spotify: searchSpotify,
  itunes: searchItunes,
};

/** Milliseconds between requests, within each service's limits. */
const PAUSES: Record<LookupSource, number> = {
  musicbrainz: 1100,
  spotify: 200,
  itunes: 3100,
};

export type LookupOptions = {
  /** Tried in order for each album, until one has a sure match. */
  sources: LookupSource[];
  signal: AbortSignal;
  onProgress: (progress: LookupProgress) => void;
  search?: Search;
  /** Milliseconds between requests (each source's own pace by default). */
  pause?: number;
  /** Milliseconds to wait after a service says to slow down. */
  backoff?: number;
};

const MAX_RETRIES = 3;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function searchWithRetry(
  album: Album,
  {
    signal,
    search,
    backoff,
  }: { signal: AbortSignal; search: Search; backoff: number },
): Promise<AlbumMatch[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await search(album, signal);
    } catch (error) {
      if (!(error instanceof RateLimitedError) || attempt >= MAX_RETRIES) {
        throw error;
      }
      await sleep(
        Math.max(error.retryAfter ?? 0, backoff * (attempt + 1)),
        signal,
      );
    }
  }
}

type Tried = { album: Album; matched: boolean; review: boolean };

/** Tries each source in turn until one matches; null when aborted. */
async function lookUpAlbum(
  album: Album,
  options: Required<Pick<LookupOptions, "sources" | "signal" | "backoff">> & {
    search?: Search;
    pause?: number;
  },
  /** Whether a request was already sent, so the next one must wait. */
  requested: { value: boolean },
): Promise<Tried | null> {
  const { sources, signal, backoff } = options;
  let current = album;
  let review = false;
  for (const source of sources) {
    if (!needsLookup(current, source)) continue;
    if (requested.value) {
      await sleep(options.pause ?? PAUSES[source], signal);
    }
    if (signal.aborted) return null;
    requested.value = true;
    let matches: AlbumMatch[];
    try {
      matches = await searchWithRetry(current, {
        signal,
        search: options.search ?? SEARCHES[source],
        backoff,
      });
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
    const outcome = pickMatch(current, matches);
    if (outcome.kind === "match") {
      return {
        album: applyMatch(current, outcome.match),
        matched: true,
        review,
      };
    }
    review ||= outcome.kind === "review";
    current = withVerdict(current, source, outcome.kind);
  }
  return { album: current, matched: false, review };
}

/**
 * Runs until every album without a cover was tried, or `signal` aborts
 * (resolves either way). Rejects when a service can't be reached; what
 * was found before stays saved.
 */
export async function lookUpCovers({
  sources,
  signal,
  onProgress,
  search,
  pause,
  backoff = 5000,
}: LookupOptions): Promise<LookupProgress> {
  const wanted = (album: Album) =>
    sources.some((source) => needsLookup(album, source));
  const ids = getAlbumsSnapshot()
    .filter(wanted)
    .map((album) => album.id);
  const progress: LookupProgress = {
    total: ids.length,
    done: 0,
    matched: 0,
    review: 0,
    notFound: 0,
  };
  onProgress({ ...progress });

  const requested = { value: false };
  for (const id of ids) {
    if (signal.aborted) break;
    // Re-read: the album may have changed (or gone) since the run started.
    const album = getAlbumsSnapshot().find((item) => item.id === id);
    if (!album || !wanted(album)) {
      progress.done++;
      continue;
    }
    const tried = await lookUpAlbum(
      album,
      { sources, signal, backoff, search, pause },
      requested,
    );
    if (!tried) break;
    saveAlbum(tried.album);
    if (tried.matched) progress.matched++;
    else if (tried.review) progress.review++;
    else progress.notFound++;
    progress.done++;
    onProgress({ ...progress });
  }
  return progress;
}
