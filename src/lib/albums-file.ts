import {
  formatJsonFile,
  parseJsonFile,
  pickFields,
  RepoFileError,
} from "@maat-apps/core/github";

import { parseAlbums, type Album } from "./schemas";

// The collection as one JSON file in the user's GitHub repository
// (github-sync.ts): an array of albums, sorted, two-space indented, so a
// diff shows exactly which album changed (core's formatJsonFile). Must stay
// byte-for-byte what the data repository's own scripts write (its
// scripts/albums.mjs), or every sync would rewrite the whole file. The
// lookup verdicts are this device's cache and stay out of it.

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

/** A file with albums the app can't read (core's `RepoFileError`). */
export { RepoFileError as AlbumsFileError };

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
  return pickFields(album, FILE_FIELDS) as FileAlbum;
}

export function formatAlbumsFile(albums: Album[]): string {
  return formatJsonFile(albums, {
    compare: compareAlbums,
    fields: FILE_FIELDS,
  });
}

/**
 * The file's albums. Throws rather than dropping an album it can't read:
 * a sync writes the file back, and would delete that album from it.
 */
export function parseAlbumsFile(text: string): Album[] {
  return parseJsonFile(text, parseAlbums, {
    notJson: "The file is not valid JSON.",
    notList: "The file is not a list of albums.",
    unreadable: (count) => `${count} albums in the file can't be read.`,
  });
}
