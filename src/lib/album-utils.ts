import type { Album, AlbumStatus } from "./schemas";

export type SortKey = "year" | "title" | "artist";
export type SortDirection = "asc" | "desc";
export type StatusFilter = AlbumStatus | "all";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Case- and accent-insensitive identity: the same album twice is a duplicate. */
export function albumIdentity(
  album: Pick<Album, "artist" | "title" | "year">,
): string {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase();
  return `${normalize(album.artist)}\u0000${normalize(album.title)}\u0000${album.year ?? ""}`;
}

export function filterByStatus(albums: Album[], filter: StatusFilter): Album[] {
  return filter === "all"
    ? albums
    : albums.filter((album) => album.status === filter);
}

export function countByStatus(albums: Album[]): Record<StatusFilter, number> {
  const counts = {
    all: albums.length,
    toListen: 0,
    comingBack: 0,
    notComingBack: 0,
  };
  for (const album of albums) counts[album.status] += 1;
  return counts;
}

function compareYears(a: number | null, b: number | null): number {
  // Albums without a year sort last in ascending order.
  return (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
}

const comparators: Record<SortKey, (a: Album, b: Album) => number> = {
  year: (a, b) => compareYears(a.year, b.year),
  title: (a, b) => collator.compare(a.title, b.title),
  artist: (a, b) => collator.compare(a.artist, b.artist),
};

// Ties fall back through the other keys, so the order is stable and
// predictable (e.g. one artist's albums by year).
const tieBreaks: Record<SortKey, SortKey[]> = {
  year: ["artist", "title"],
  title: ["artist", "year"],
  artist: ["year", "title"],
};

/** A sorted copy; `direction` flips only the primary key. */
export function sortAlbums(
  albums: Album[],
  key: SortKey,
  direction: SortDirection,
): Album[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...albums].sort((a, b) => {
    const primary = comparators[key](a, b) * sign;
    if (primary !== 0) return primary;
    for (const tieKey of tieBreaks[key]) {
      const result = comparators[tieKey](a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * `current` plus the `incoming` albums it lacks; an album in both (by id)
 * keeps the more recently edited version, and ties keep the current one. An
 * incoming album that is the same album as a current one under another id
 * (see `albumIdentity`) is skipped. A merge never deletes.
 */
export function mergeAlbums(current: Album[], incoming: Album[]): Album[] {
  const incomingById = new Map(incoming.map((album) => [album.id, album]));
  const merged = current.map((album) => {
    const other = incomingById.get(album.id);
    return other && other.updatedAt > album.updatedAt ? other : album;
  });
  const knownIds = new Set(current.map((album) => album.id));
  const knownIdentities = new Set(current.map(albumIdentity));
  const added = incoming.filter((album) => {
    if (knownIds.has(album.id)) return false;
    const identity = albumIdentity(album);
    if (knownIdentities.has(identity)) return false;
    knownIdentities.add(identity);
    return true;
  });
  return [...merged, ...added];
}
