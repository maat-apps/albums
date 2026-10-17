import type { Album } from "./schemas";

// The streaming services an album can link to, and the user's choice
// among them (app-settings.ts). Links come from MusicBrainz's URL
// relationships and, for Apple Music, from iTunes' search results; each is
// kept in its plain form, so the same album always gets the same URL.

export const STREAMING_SERVICES = ["deezer", "spotify", "appleMusic"] as const;

export type StreamingService = (typeof STREAMING_SERVICES)[number];

/** The album field holding each service's link. */
export const LINK_FIELDS = {
  deezer: "deezerUrl",
  spotify: "spotifyUrl",
  appleMusic: "appleMusicUrl",
} as const satisfies Record<StreamingService, keyof Album>;

export type StreamingLinks = Partial<Record<StreamingService, string>>;

const PATTERNS: Record<StreamingService, RegExp> = {
  // https://www.deezer.com/album/1, also with a language ("/en/")
  deezer: /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/,
  // https://open.spotify.com/album/abc, also "/intl-pl/album/abc"
  spotify:
    /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]+)/,
  // https://music.apple.com/us/album/title/123 (or itunes.apple.com, "id123")
  appleMusic:
    /^https?:\/\/(?:music|itunes)\.apple\.com\/([a-z]{2})\/album\/(?:[^/?]+\/)?(?:id)?(\d+)/,
};

function plainLink(service: StreamingService, url: string): string | null {
  const match = PATTERNS[service].exec(url);
  if (!match) return null;
  switch (service) {
    case "deezer":
      return `https://www.deezer.com/album/${match[1]}`;
    case "spotify":
      return `https://open.spotify.com/album/${match[1]}`;
    case "appleMusic":
      return `https://music.apple.com/${match[1]}/album/${match[2]}`;
  }
}

/** The album links among `urls`, the first one per service, plain. */
export function readLinks(urls: Iterable<string>): StreamingLinks {
  const links: StreamingLinks = {};
  for (const url of urls) {
    for (const service of STREAMING_SERVICES) {
      if (links[service]) continue;
      const link = plainLink(service, url);
      if (link) links[service] = link;
    }
  }
  return links;
}

/** The album's link to `service`, if it has one. */
export function linkTo(
  album: Album,
  service: StreamingService,
): string | undefined {
  return album[LINK_FIELDS[service]];
}

/** The album with the links it was missing filled in from `links`. */
export function withLinks(album: Album, links: StreamingLinks): Album {
  const filled = { ...album };
  for (const service of STREAMING_SERVICES) {
    const field = LINK_FIELDS[service];
    filled[field] = album[field] ?? links[service];
  }
  return filled;
}
