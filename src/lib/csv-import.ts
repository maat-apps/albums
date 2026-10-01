import { albumIdentity } from "./album-utils";
import { parseCsv } from "./csv";
import type { Album, AlbumStatus } from "./schemas";

// Imports a list exported from a spreadsheet as CSV (see PRODUCT.md). The
// header row names the columns, in any order, in Polish or English.

const COLUMN_NAMES = {
  year: ["rok", "year"],
  artist: ["artysta", "artist"],
  title: ["tytuł", "tytul", "title"],
  status: ["wracam?", "wracam", "status"],
} as const;

type Column = keyof typeof COLUMN_NAMES;

const STATUS_VALUES: Record<string, AlbumStatus> = {
  "": "toListen",
  green: "comingBack",
  red: "notComingBack",
};

export type CsvImportResult = {
  /** The new albums, ready to be added. */
  albums: Album[];
  /** Rows already in the collection, or repeated earlier in the file. */
  skipped: number;
  /** Rows without an artist or title, or with an unknown status. */
  invalid: number;
};

export class CsvImportError extends Error {}

function findColumns(header: string[]): Record<Column, number> {
  const normalized = header.map((name) => name.trim().toLowerCase());
  const indexOf = (column: Column) =>
    normalized.findIndex((name) =>
      (COLUMN_NAMES[column] as readonly string[]).includes(name),
    );
  const columns = {
    year: indexOf("year"),
    artist: indexOf("artist"),
    title: indexOf("title"),
    status: indexOf("status"),
  };
  if (columns.artist === -1 || columns.title === -1) {
    throw new CsvImportError("missingColumns");
  }
  return columns;
}

function parseYear(value: string): number | null {
  return /^\d{4}$/.test(value) ? Number(value) : null;
}

/**
 * The albums in `text` that aren't in `existing` yet. Throws
 * `CsvImportError("missingColumns")` when there's no artist/title header.
 */
export function importAlbumsFromCsv(
  text: string,
  existing: Album[],
  now = new Date(),
): CsvImportResult {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new CsvImportError("missingColumns");
  const columns = findColumns(header);
  const cell = (row: string[], column: Column) =>
    columns[column] === -1 ? "" : (row[columns[column]] ?? "").trim();

  const seen = new Set(existing.map(albumIdentity));
  const result: CsvImportResult = { albums: [], skipped: 0, invalid: 0 };

  for (const row of rows) {
    const artist = cell(row, "artist");
    const title = cell(row, "title");
    const status = STATUS_VALUES[cell(row, "status").toLowerCase()];
    if (!artist || !title || !status) {
      result.invalid += 1;
      continue;
    }
    const year = parseYear(cell(row, "year"));
    const identity = albumIdentity({ artist, title, year });
    if (seen.has(identity)) {
      result.skipped += 1;
      continue;
    }
    seen.add(identity);
    result.albums.push({
      id: crypto.randomUUID(),
      year,
      artist,
      title,
      status,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }
  return result;
}
