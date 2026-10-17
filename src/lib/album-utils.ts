import type { Album, AlbumStatus } from "./schemas";

export type SortKey = "year" | "title" | "artist";
export type SortDirection = "asc" | "desc";
export type StatusFilter = AlbumStatus | "all";

// Polish rules, so Ą sorts after A and Ł after L — each a letter of its
// own, as on the fast scroller's rail (`groupAlbums`).
const collator = new Intl.Collator("pl", { sensitivity: "base" });

// Letters that don't decompose into base + accent under NFD.
const FOLDED_LETTERS: Record<string, string> = { ł: "l", ø: "o", đ: "d" };

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[łøđ]/g, (letter) => FOLDED_LETTERS[letter] ?? letter)
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

/**
 * Artist and title with case, accents, punctuation, spacing, "&" vs "and"
 * and a leading "The" ignored. The year is compared apart (`sameAlbum`).
 */
export function albumKey(album: Pick<Album, "artist" | "title">): string {
  return `${normalizeText(album.artist)}\u0000${normalizeText(album.title)}`;
}

/**
 * Whether two albums are the same record: equal `albumKey`, and equal years
 * unless one of them has none (a missing year can't tell a reissue apart).
 */
export function sameAlbum(
  a: Pick<Album, "artist" | "title" | "year">,
  b: Pick<Album, "artist" | "title" | "year">,
): boolean {
  if (albumKey(a) !== albumKey(b)) return false;
  return a.year === null || b.year === null || a.year === b.year;
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

/** A run of albums sharing a fast-scroller label, from `firstIndex` on. */
export type AlbumGroup = { label: string; firstIndex: number };

/** Year groups become decades once the years span more than this. */
export const DECADE_SPAN = 20;

const POLISH_LETTERS = new Set("ĄĆĘŁŃÓŚŹŻ");

/**
 * The first letter, upper-cased: Polish letters stay themselves (the
 * collator sorts them apart), other accents fold to the base letter (the
 * collator sorts them together), anything else is "#".
 */
export function letterLabel(text: string): string {
  const first = [...text.trim()][0]?.toLocaleUpperCase("pl") ?? "";
  if (POLISH_LETTERS.has(first)) return first;
  const base = first.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return /^\p{L}$/u.test(base) ? base : "#";
}

function yearLabeller(albums: Album[]): (year: number | null) => string {
  const years = albums.flatMap((album) =>
    album.year === null ? [] : [album.year],
  );
  const decades =
    years.length > 0 && Math.max(...years) - Math.min(...years) > DECADE_SPAN;
  return (year) => {
    if (year === null) return "—";
    if (!decades) return String(year);
    const start = Math.floor(year / 10) * 10;
    return `${start}–${start + 9}`;
  };
}

/**
 * The fast scroller's groups for albums already sorted by `key`: by first
 * letter for artist/title, by year — or decade, when the years span more
 * than `DECADE_SPAN` — for year. Groups follow the list's own order, so a
 * descending sort flips them too.
 */
export function groupAlbums(sorted: Album[], key: SortKey): AlbumGroup[] {
  const yearOf = yearLabeller(sorted);
  const labelOf =
    key === "year"
      ? (album: Album) => yearOf(album.year)
      : (album: Album) => letterLabel(album[key]);
  const groups: AlbumGroup[] = [];
  sorted.forEach((album, index) => {
    const label = labelOf(album);
    if (groups.at(-1)?.label !== label)
      groups.push({ label, firstIndex: index });
  });
  return groups;
}
