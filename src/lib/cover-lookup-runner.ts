import {
  applyMatch,
  needsLookup,
  pickMatch,
  withVerdict,
  type AlbumMatch,
  type LookupSource,
} from "./cover-lookup";
import { RateLimitedError, searchMusicBrainz } from "./musicbrainz";
import type { Album } from "./schemas";
import { searchSpotify } from "./spotify-api";
import { getAlbumsSnapshot, saveAlbum } from "./storage";

// Looks every album missing something up — on Spotify when it's connected
// (cover, link, year; fast), otherwise on MusicBrainz (cover, year; one
// request a second, so a 1000-album CSV takes about 20 minutes). Stopping
// keeps everything found so far: each album is saved as it's done, and the
// next run skips it.

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
};

/** Milliseconds between requests, within each service's limits. */
const PAUSES: Record<LookupSource, number> = {
  musicbrainz: 1100,
  spotify: 200,
};

export type LookupOptions = {
  source: LookupSource;
  signal: AbortSignal;
  onProgress: (progress: LookupProgress) => void;
  search?: Search;
  /** Milliseconds between requests (the source's own pace by default). */
  pause?: number;
  /** Milliseconds to wait after MusicBrainz says to slow down. */
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

/**
 * Runs until every album without a cover was tried, or `signal` aborts
 * (resolves either way). Rejects when MusicBrainz can't be reached; what
 * was found before stays saved.
 */
export async function lookUpCovers({
  source,
  signal,
  onProgress,
  search = SEARCHES[source],
  pause = PAUSES[source],
  backoff = 5000,
}: LookupOptions): Promise<LookupProgress> {
  const ids = getAlbumsSnapshot()
    .filter((album) => needsLookup(album, source))
    .map((album) => album.id);
  const progress: LookupProgress = {
    total: ids.length,
    done: 0,
    matched: 0,
    review: 0,
    notFound: 0,
  };
  onProgress({ ...progress });

  let searched = false;
  for (const id of ids) {
    if (signal.aborted) break;
    // Re-read: the album may have changed (or gone) since the run started.
    const album = getAlbumsSnapshot().find((item) => item.id === id);
    if (!album || !needsLookup(album, source)) {
      progress.done++;
      continue;
    }
    // Pause between requests only — not before the first or after the last.
    if (searched) await sleep(pause, signal);
    if (signal.aborted) break;
    searched = true;
    let matches: AlbumMatch[];
    try {
      matches = await searchWithRetry(album, { signal, search, backoff });
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
    const outcome = pickMatch(album, matches);
    if (outcome.kind === "match") {
      saveAlbum(applyMatch(album, outcome.match));
      progress.matched++;
    } else {
      saveAlbum(withVerdict(album, source, outcome.kind));
      progress[outcome.kind === "review" ? "review" : "notFound"]++;
    }
    progress.done++;
    onProgress({ ...progress });
  }
  return progress;
}
