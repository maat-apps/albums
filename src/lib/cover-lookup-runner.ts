import { applyMatch, needsLookup, pickMatch } from "./cover-lookup";
import {
  RateLimitedError,
  searchReleaseGroups,
  type ReleaseGroup,
} from "./musicbrainz";
import type { Album } from "./schemas";
import { getAlbumsSnapshot, saveAlbum } from "./storage";

// Looks every album without a cover up on MusicBrainz, one at a time at its
// one-request-a-second limit — a 1000-album CSV takes about 20 minutes, and
// stopping keeps everything found so far (each album is saved as it's
// done, and the next run skips it).

export type LookupProgress = {
  total: number;
  done: number;
  matched: number;
  review: number;
  notFound: number;
};

export type LookupOptions = {
  signal: AbortSignal;
  onProgress: (progress: LookupProgress) => void;
  search?: (album: Album, signal: AbortSignal) => Promise<ReleaseGroup[]>;
  /** Milliseconds between requests. */
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
  }: Required<Pick<LookupOptions, "signal" | "search" | "backoff">>,
): Promise<ReleaseGroup[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await search(album, signal);
    } catch (error) {
      if (!(error instanceof RateLimitedError) || attempt >= MAX_RETRIES) {
        throw error;
      }
      await sleep(backoff * (attempt + 1), signal);
    }
  }
}

/**
 * Runs until every album without a cover was tried, or `signal` aborts
 * (resolves either way). Rejects when MusicBrainz can't be reached; what
 * was found before stays saved.
 */
export async function lookUpCovers({
  signal,
  onProgress,
  search = searchReleaseGroups,
  pause = 1100,
  backoff = 5000,
}: LookupOptions): Promise<LookupProgress> {
  const ids = getAlbumsSnapshot()
    .filter(needsLookup)
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
    if (!album || !needsLookup(album)) {
      progress.done++;
      continue;
    }
    // Pause between requests only — not before the first or after the last.
    if (searched) await sleep(pause, signal);
    if (signal.aborted) break;
    searched = true;
    let groups: ReleaseGroup[];
    try {
      groups = await searchWithRetry(album, { signal, search, backoff });
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
    const outcome = pickMatch(album, groups);
    if (outcome.kind === "match") {
      saveAlbum(applyMatch(album, outcome.match));
      progress.matched++;
    } else {
      saveAlbum({ ...album, lookup: outcome.kind });
      progress[outcome.kind === "review" ? "review" : "notFound"]++;
    }
    progress.done++;
    onProgress({ ...progress });
  }
  return progress;
}
