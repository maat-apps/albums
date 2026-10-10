import { isHttpsUrl, type Album, type AlbumStatus } from "./schemas";

// The add/edit form's values as typed (strings), and the pure conversion
// to and from an Album — kept out of the view so it's unit-tested.

export type AlbumFormValues = {
  year: string;
  artist: string;
  title: string;
  status: AlbumStatus;
  coverUrl: string;
};

export type AlbumFormField = keyof AlbumFormValues;
export type AlbumFormError = "required" | "year" | "url";
export type AlbumFormErrors = Partial<Record<AlbumFormField, AlbumFormError>>;

export const EMPTY_ALBUM_FORM: AlbumFormValues = {
  year: "",
  artist: "",
  title: "",
  status: "toListen",
  coverUrl: "",
};

export function albumToForm(album: Album): AlbumFormValues {
  return {
    year: album.year === null ? "" : String(album.year),
    artist: album.artist,
    title: album.title,
    status: album.status,
    coverUrl: album.coverUrl ?? "",
  };
}

const YEAR_PATTERN = /^\d{4}$/;

export function validateAlbumForm(values: AlbumFormValues): AlbumFormErrors {
  const errors: AlbumFormErrors = {};
  if (!values.artist.trim()) errors.artist = "required";
  if (!values.title.trim()) errors.title = "required";
  if (values.year.trim() && !YEAR_PATTERN.test(values.year.trim())) {
    errors.year = "year";
  }
  const coverUrl = values.coverUrl.trim();
  if (coverUrl && !isHttpsUrl(coverUrl)) errors.coverUrl = "url";
  return errors;
}

/**
 * The album the form describes — `base` keeps an edited album's id and
 * createdAt. Call only once validateAlbumForm found no errors.
 */
export function formToAlbum(
  values: AlbumFormValues,
  base: Album | null,
  now = new Date(),
): Album {
  const year = values.year.trim();
  const coverUrl = values.coverUrl.trim();
  return {
    id: base?.id ?? crypto.randomUUID(),
    createdAt: base?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    year: year ? Number(year) : null,
    artist: values.artist.trim(),
    title: values.title.trim(),
    status: values.status,
    ...(coverUrl && { coverUrl }),
  };
}
