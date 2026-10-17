import { describe, expect, it } from "vitest";

import type { Album } from "@/lib/schemas";
import { linkTo, readLinks, withLinks } from "@/lib/streaming";

const album: Album = {
  id: "a1",
  year: 1999,
  artist: "Zeta Band",
  title: "Made-up Title",
  status: "toListen",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("readLinks", () => {
  it.each([
    [
      "https://www.deezer.com/en/album/42",
      "deezer",
      "https://www.deezer.com/album/42",
    ],
    [
      "https://open.spotify.com/intl-pl/album/Ab12",
      "spotify",
      "https://open.spotify.com/album/Ab12",
    ],
    [
      "https://music.apple.com/pl/album/some-title/1440?i=1",
      "appleMusic",
      "https://music.apple.com/pl/album/1440",
    ],
    [
      "https://itunes.apple.com/us/album/id77",
      "appleMusic",
      "https://music.apple.com/us/album/77",
    ],
  ])("reads %s as a %s link", (url, service, plain) => {
    expect(readLinks([url])).toEqual({ [service]: plain });
  });

  it("keeps each service's first link and ignores anything else", () => {
    expect(
      readLinks([
        "https://www.deezer.com/artist/1",
        "https://open.spotify.com/track/x",
        "https://www.deezer.com/album/1",
        "https://www.deezer.com/album/2",
      ]),
    ).toEqual({ deezer: "https://www.deezer.com/album/1" });
  });
});

describe("linkTo / withLinks", () => {
  it("reads and fills the album's links, keeping the ones it has", () => {
    const linked = withLinks(
      { ...album, spotifyUrl: "https://open.spotify.com/album/own" },
      {
        deezer: "https://www.deezer.com/album/1",
        spotify: "https://open.spotify.com/album/other",
      },
    );
    expect(linkTo(linked, "deezer")).toBe("https://www.deezer.com/album/1");
    expect(linkTo(linked, "spotify")).toBe(
      "https://open.spotify.com/album/own",
    );
    expect(linkTo(linked, "appleMusic")).toBeUndefined();
  });
});
