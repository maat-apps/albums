import { describe, expect, it } from "vitest";

import {
  albumToForm,
  EMPTY_ALBUM_FORM,
  formToAlbum,
  validateAlbumForm,
} from "@/lib/album-form";
import type { Album } from "@/lib/schemas";

const NOW = new Date("2026-10-02T10:00:00.000Z");

const album: Album = {
  id: "a1",
  year: 1977,
  artist: "Artist",
  title: "Title",
  status: "comingBack",
  coverUrl: "https://example.com/cover.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("albumToForm", () => {
  it("turns an album into form strings", () => {
    expect(albumToForm(album)).toEqual({
      year: "1977",
      artist: "Artist",
      title: "Title",
      status: "comingBack",
      coverUrl: "https://example.com/cover.jpg",
      spotifyUrl: "",
    });
  });

  it("fills the Spotify URL and leaves a missing cover empty", () => {
    expect(
      albumToForm({
        ...album,
        coverUrl: undefined,
        spotifyUrl: "https://open.spotify.com/x",
      }),
    ).toMatchObject({ coverUrl: "", spotifyUrl: "https://open.spotify.com/x" });
  });

  it("leaves an unknown year empty", () => {
    expect(albumToForm({ ...album, year: null }).year).toBe("");
  });
});

describe("validateAlbumForm", () => {
  it("requires artist and title", () => {
    expect(validateAlbumForm(EMPTY_ALBUM_FORM)).toEqual({
      artist: "required",
      title: "required",
    });
  });

  it("accepts a valid form with an empty year and no URLs", () => {
    expect(
      validateAlbumForm({ ...EMPTY_ALBUM_FORM, artist: "A", title: "T" }),
    ).toEqual({});
  });

  it("rejects a year that isn't four digits", () => {
    expect(
      validateAlbumForm({
        ...EMPTY_ALBUM_FORM,
        artist: "A",
        title: "T",
        year: "77",
      }),
    ).toEqual({ year: "year" });
  });

  it("rejects URLs that aren't https", () => {
    expect(
      validateAlbumForm({
        ...EMPTY_ALBUM_FORM,
        artist: "A",
        title: "T",
        coverUrl: "http://example.com/a.jpg",
        spotifyUrl: "spotify",
      }),
    ).toEqual({ coverUrl: "url", spotifyUrl: "url" });
  });
});

describe("formToAlbum", () => {
  it("creates a new album from trimmed values", () => {
    const created = formToAlbum(
      {
        ...EMPTY_ALBUM_FORM,
        year: " 1999 ",
        artist: " A ",
        title: " T ",
        spotifyUrl: " https://open.spotify.com/album/x ",
      },
      null,
      NOW,
    );
    expect(created).toMatchObject({
      year: 1999,
      artist: "A",
      title: "T",
      status: "toListen",
      spotifyUrl: "https://open.spotify.com/album/x",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(created).not.toHaveProperty("coverUrl");
  });

  it("keeps an edited album's id and createdAt, and clears emptied fields", () => {
    const edited = formToAlbum(
      { ...albumToForm(album), year: "", coverUrl: "" },
      album,
      NOW,
    );
    expect(edited).toMatchObject({
      id: "a1",
      createdAt: album.createdAt,
      updatedAt: NOW.toISOString(),
      year: null,
    });
    expect(edited).not.toHaveProperty("coverUrl");
  });

  it("keeps a cover URL that's still set", () => {
    expect(formToAlbum(albumToForm(album), album, NOW).coverUrl).toBe(
      album.coverUrl,
    );
  });
});
