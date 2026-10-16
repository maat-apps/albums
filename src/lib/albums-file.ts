import { parseAlbums, type Album } from "./schemas";

// The collection as one JSON file in the user's GitHub repository
// (github-sync.ts): an array of albums, sorted, two-space indented, so a
// diff shows exactly which album changed. Must stay byte-for-byte what the
// data repository's own scripts write (its scripts/albums.mjs), or every
// sync would rewrite the whole file. The lookup verdicts are this device's
// cache and stay out of it.

/** Field order of an album in the file; anything else is left out. */
const FILE_FIELDS = [
  "id",
  "year",
  "artist",
  "title",
  "status",
  "coverUrl",
  "deezerUrl",
  "spotifyUrl",
  "appleMusicUrl",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof Album)[];

export type FileAlbum = Pick<Album, (typeof FILE_FIELDS)[number]>;

export class AlbumsFileError extends Error {}

const collator = new Intl.Collator("pl", { sensitivity: "base" });

/** Artist, then year (none last), then title. */
function compareAlbums(a: Album, b: Album): number {
  return (
    collator.compare(a.artist, b.artist) ||
    (a.year ?? Infinity) - (b.year ?? Infinity) ||
    collator.compare(a.title, b.title) ||
    a.id.localeCompare(b.id)
  );
}

/** The album as the file holds it: fields in file order, empty ones left out. */
export function toFileAlbum(album: Album): FileAlbum {
  const fileAlbum: Partial<Record<keyof FileAlbum, unknown>> = {};
  for (const field of FILE_FIELDS) {
    if (album[field] !== undefined) fileAlbum[field] = album[field];
  }
  return fileAlbum as FileAlbum;
}

export function formatAlbumsFile(albums: Album[]): string {
  const sorted = [...albums].sort(compareAlbums).map(toFileAlbum);
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/**
 * The file's albums. Throws rather than dropping an album it can't read:
 * a sync writes the file back, and would delete that album from it.
 */
export function parseAlbumsFile(text: string): Album[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AlbumsFileError("The file is not valid JSON.");
  }
  if (!Array.isArray(value)) {
    throw new AlbumsFileError("The file is not a list of albums.");
  }
  const albums = parseAlbums(value);
  if (albums.length !== value.length) {
    throw new AlbumsFileError(
      `${value.length - albums.length} albums in the file can't be read.`,
    );
  }
  return albums;
}
