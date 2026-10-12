import {
  applyMatch,
  needsLookup,
  pickMatch,
  withVerdict,
  type AlbumMatch,
  type LookupSource,
} from "./cover-lookup";
import { searchDeezer } from "./deezer";
import { searchItunes } from "./itunes";
import { RateLimitedError, searchMusicBrainz } from "./musicbrainz";
import type { Album } from "./schemas";
import { getAlbumsSnapshot, saveAlbum } from "./storage";

// Looks every album missing something up on each source in turn, for what
// the ones before left missing: Deezer (cover, link; four requests a
// second), MusicBrainz (cover, year; one a second), then iTunes (cover).
// A source that can't be reached is left out for the rest of the run.
// Stopping keeps everything found so far: each album is saved as it's done,
// and the next run skips it.

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

/** Every source, in the order each album is looked up on them. */
export const LOOKUP_SOURCES: LookupSource[] = [
  "deezer",
  "musicbrainz",
  "itunes",
];

export const SEARCHES: Record<LookupSource, Search> = {
  deezer: searchDeezer,
  musicbrainz: searchMusicBrainz,
  itunes: searchItunes,
};

/** Milliseconds between requests, within each service's limits. */
const PAUSES: Record<LookupSource, number> = {
  deezer: 250,
  musicbrainz: 1100,
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

type Tried = {
  album: Album;
  /** Whether any source was asked — not when all it needed were out. */
  searched: boolean;
  matched: boolean;
  review: boolean;
};

type RunState = {
  /** Whether a request was already sent, so the next one must wait. */
  requested: boolean;
  /** Sources that failed this run, and the last failure. */
  unavailable: Set<LookupSource>;
  error?: unknown;
};

/**
 * Asks each source in turn for what the album still misses; null when
 * aborted. A failing source joins `run.unavailable`.
 */
async function lookUpAlbum(
  album: Album,
  options: Required<Pick<LookupOptions, "sources" | "signal" | "backoff">> & {
    search?: Search;
    pause?: number;
  },
  run: RunState,
): Promise<Tried | null> {
  const { sources, signal, backoff } = options;
  const tried: Tried = {
    album,
    searched: false,
    matched: false,
    review: false,
  };
  for (const source of sources) {
    if (run.unavailable.has(source)) continue;
    if (!needsLookup(tried.album, source)) continue;
    if (run.requested) {
      await sleep(options.pause ?? PAUSES[source], signal);
    }
    if (signal.aborted) return null;
    run.requested = true;
    let matches: AlbumMatch[];
    try {
      matches = await searchWithRetry(tried.album, {
        signal,
        search: options.search ?? SEARCHES[source],
        backoff,
      });
    } catch (error) {
      if (signal.aborted) return null;
      run.unavailable.add(source);
      run.error = error;
      continue;
    }
    tried.searched = true;
    const outcome = pickMatch(tried.album, matches);
    if (outcome.kind === "match") {
      tried.album = applyMatch(tried.album, outcome.match);
      tried.matched = true;
    } else {
      tried.review ||= outcome.kind === "review";
      tried.album = withVerdict(tried.album, source, outcome.kind);
    }
  }
  return tried;
}

/**
 * Runs until every album missing something was tried, or `signal` aborts
 * (resolves either way). Rejects once no source can be reached; what was
 * found before stays saved.
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

  const run: RunState = { requested: false, unavailable: new Set() };
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
      run,
    );
    if (!tried) break;
    if (sources.every((source) => run.unavailable.has(source))) {
      throw run.error;
    }
    progress.done++;
    if (tried.searched) {
      saveAlbum(tried.album);
      if (tried.matched) progress.matched++;
      else if (tried.review) progress.review++;
      else progress.notFound++;
    }
    onProgress({ ...progress });
  }
  return progress;
}

/**
 * Looks one album up right away — when it's opened — and saves what was
 * found, unless the album changed meanwhile. Albums with nothing left to
 * find, or already tried, aren't searched again.
 */
export async function lookUpAlbumNow(
  id: string,
  signal: AbortSignal,
): Promise<void> {
  const find = () => getAlbumsSnapshot().find((item) => item.id === id);
  const album = find();
  if (!album) return;
  if (!LOOKUP_SOURCES.some((source) => needsLookup(album, source))) return;
  const tried = await lookUpAlbum(
    album,
    { sources: LOOKUP_SOURCES, signal, backoff: 5000 },
    { requested: false, unavailable: new Set() },
  );
  if (!tried?.searched || find()?.updatedAt !== album.updatedAt) return;
  saveAlbum(tried.album);
}
