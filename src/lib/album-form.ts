import { coverArtUrl, type ReleaseGroup } from "./musicbrainz";
import { isHttpsUrl, type Album, type AlbumStatus } from "./schemas";

// Adding an album found on MusicBrainz, and the edit form's values as typed (strings), and the pure conversion
// to and from an Album — kept out of the view so it's unit-tested.

export type AlbumFormValues = {
  year: string;
  artist: string;
  title: string;
  status: AlbumStatus;
  coverUrl: string;
  deezerUrl: string;
  spotifyUrl: string;
  appleMusicUrl: string;
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
  deezerUrl: "",
  spotifyUrl: "",
  appleMusicUrl: "",
};

export function albumToForm(album: Album): AlbumFormValues {
  return {
    year: album.year === null ? "" : String(album.year),
    artist: album.artist,
    title: album.title,
    status: album.status,
    coverUrl: album.coverUrl ?? "",
    deezerUrl: album.deezerUrl ?? "",
    spotifyUrl: album.spotifyUrl ?? "",
    appleMusicUrl: album.appleMusicUrl ?? "",
  };
}

const YEAR_PATTERN = /^\d{4}$/;

const URL_FIELDS = [
  "coverUrl",
  "deezerUrl",
  "spotifyUrl",
  "appleMusicUrl",
] as const;

export function validateAlbumForm(values: AlbumFormValues): AlbumFormErrors {
  const errors: AlbumFormErrors = {};
  if (!values.artist.trim()) errors.artist = "required";
  if (!values.title.trim()) errors.title = "required";
  if (values.year.trim() && !YEAR_PATTERN.test(values.year.trim())) {
    errors.year = "year";
  }
  for (const field of URL_FIELDS) {
    const url = values[field].trim();
    if (url && !isHttpsUrl(url)) errors[field] = "url";
  }
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
  const urls = Object.fromEntries(
    URL_FIELDS.flatMap((field) => {
      const url = values[field].trim();
      return url ? [[field, url]] : [];
    }),
  );
  return {
    id: base?.id ?? crypto.randomUUID(),
    createdAt: base?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    year: year ? Number(year) : null,
    artist: values.artist.trim(),
    title: values.title.trim(),
    status: values.status,
    ...urls,
  };
}

/**
 * A new album, to listen to, from a MusicBrainz search result, its cover
 * from the archive. Its streaming links come from the album's own lookup.
 */
export function releaseGroupToAlbum(
  group: ReleaseGroup,
  now = new Date(),
): Album {
  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    year: group.year,
    artist: group.artist,
    title: group.title,
    status: "toListen",
    coverUrl: coverArtUrl(group.id),
  };
}
