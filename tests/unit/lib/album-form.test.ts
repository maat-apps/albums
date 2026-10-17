import { describe, expect, it } from "vitest";

import {
  albumToForm,
  EMPTY_ALBUM_FORM,
  formToAlbum,
  releaseGroupToAlbum,
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
  deezerUrl: "https://www.deezer.com/album/302127",
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
      deezerUrl: "https://www.deezer.com/album/302127",
      spotifyUrl: "",
      appleMusicUrl: "",
    });
  });

  it("leaves a missing cover and Deezer link empty", () => {
    const form = albumToForm({
      ...album,
      coverUrl: undefined,
      deezerUrl: undefined,
    });
    expect(form).toMatchObject({ coverUrl: "", deezerUrl: "" });
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

  it("rejects a cover URL that isn't https", () => {
    expect(
      validateAlbumForm({
        ...EMPTY_ALBUM_FORM,
        artist: "A",
        title: "T",
        coverUrl: "http://example.com/a.jpg",
      }),
    ).toEqual({ coverUrl: "url" });
  });

  it("rejects a Deezer URL that isn't https", () => {
    expect(
      validateAlbumForm({
        ...EMPTY_ALBUM_FORM,
        artist: "A",
        title: "T",
        deezerUrl: "deezer.com/album/1",
      }),
    ).toEqual({ deezerUrl: "url" });
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
      },
      null,
      NOW,
    );
    expect(created).toMatchObject({
      year: 1999,
      artist: "A",
      title: "T",
      status: "toListen",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(created).not.toHaveProperty("coverUrl");
    expect(created).not.toHaveProperty("deezerUrl");
  });

  it("trims the cover and Deezer URLs", () => {
    expect(
      formToAlbum(
        {
          ...EMPTY_ALBUM_FORM,
          coverUrl: " https://example.com/c.jpg ",
          deezerUrl: " https://www.deezer.com/album/1 ",
        },
        null,
        NOW,
      ),
    ).toMatchObject({
      coverUrl: "https://example.com/c.jpg",
      deezerUrl: "https://www.deezer.com/album/1",
    });
  });

  it("keeps an edited album's id and createdAt, and clears emptied fields", () => {
    const edited = formToAlbum(
      { ...albumToForm(album), year: "", coverUrl: "", deezerUrl: "" },
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
    expect(edited).not.toHaveProperty("deezerUrl");
  });

  it("keeps a cover URL that's still set", () => {
    expect(formToAlbum(albumToForm(album), album, NOW).coverUrl).toBe(
      album.coverUrl,
    );
  });
});

describe("releaseGroupToAlbum", () => {
  it("adds a found album to listen to, with the archive's cover", () => {
    const created = releaseGroupToAlbum(
      {
        id: "rg1",
        title: "Made-up Title",
        artist: "Zeta Band",
        year: null,
        primaryType: "Album",
      },
      NOW,
    );
    expect(created).toEqual({
      id: expect.any(String),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      year: null,
      artist: "Zeta Band",
      title: "Made-up Title",
      status: "toListen",
      coverUrl: "https://coverartarchive.org/release-group/rg1/front-1200",
    });
  });
});
