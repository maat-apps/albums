import { useEffect, useState } from "react";

import type { LookupSource } from "../../lib/cover-lookup";
import { LOOKUP_SOURCES, SEARCHES } from "../../lib/cover-lookup-runner";
import { searchUrl as deezerSearch } from "../../lib/deezer";
import { searchUrl as itunesSearch } from "../../lib/itunes";
import { searchUrl as musicBrainzSearch } from "../../lib/musicbrainz";

// TEMPORARY (PR #34): shows why a source fails on a phone, without dev
// tools. A response the browser blocks for CORS hides its status and
// headers from the page, so a second request in "no-cors" mode tells the
// two causes apart: it reaches the server when only CORS is missing, and
// fails too when the network or a blocker (e.g. Brave Shields) stops it.
// Also tries Odesli (song.link): iTunes' first album → its Deezer link.

type Query = { artist: string; title: string };
type Probe = { name: string; url: string; run: () => Promise<string> };

const URLS: Record<LookupSource, (album: Query) => string> = {
  deezer: deezerSearch,
  musicbrainz: musicBrainzSearch,
  itunes: itunesSearch,
};

const ODESLI_URL = "https://api.song.link/v1-alpha.1/links";

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function explain(error: unknown, url: string): Promise<string> {
  try {
    const opaque = await fetch(url, {
      mode: "no-cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    return `${describe(error)} · no-cors probe reached the server (${opaque.type}) → CORS blocks it`;
  } catch (probeError) {
    return `${describe(error)} · no-cors probe failed too (${describe(probeError)}) → network or a blocker`;
  }
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function sourceProbe(source: LookupSource, album: Query): Probe {
  const url = URLS[source](album);
  return {
    name: source,
    url,
    run: async () => {
      try {
        const matches = await SEARCHES[source](
          album,
          new AbortController().signal,
        );
        return `OK — ${matches.length} result(s)`;
      } catch (error) {
        return explain(error, url);
      }
    },
  };
}

function odesliProbe(album: Query): Probe {
  const itunesUrl = itunesSearch(album);
  return {
    name: "odesli",
    url: `${ODESLI_URL}?url=<iTunes' first album>&userCountry=PL`,
    run: async () => {
      let appleUrl: string | undefined;
      try {
        const found = (await getJson(itunesUrl)) as {
          results?: { collectionViewUrl?: string }[];
        };
        appleUrl = found.results?.[0]?.collectionViewUrl;
      } catch (error) {
        return `iTunes step failed — ${describe(error)}`;
      }
      if (!appleUrl) return "iTunes found no album to look up";
      const url = `${ODESLI_URL}?${new URLSearchParams({ url: appleUrl, userCountry: "PL" })}`;
      try {
        const links = (await getJson(url)) as {
          linksByPlatform?: Record<string, { url?: string }>;
        };
        const deezer = links.linksByPlatform?.deezer?.url;
        return deezer
          ? `OK — Deezer: ${deezer} (from ${appleUrl})`
          : `OK, but no Deezer link for ${appleUrl}`;
      } catch (error) {
        return explain(error, url);
      }
    },
  };
}

export function LookupDiagnostics({ artist, title }: Query) {
  const [lines, setLines] = useState<Record<string, string>>({});
  const album = { artist, title };
  const probes = [
    ...LOOKUP_SOURCES.map((source) => sourceProbe(source, album)),
    odesliProbe(album),
  ];

  useEffect(() => {
    let current = true;
    const query = { artist, title };
    for (const { name, run } of [
      ...LOOKUP_SOURCES.map((source) => sourceProbe(source, query)),
      odesliProbe(query),
    ]) {
      void run().then((line) => {
        if (current) setLines((previous) => ({ ...previous, [name]: line }));
      });
    }
    return () => {
      current = false;
    };
  }, [artist, title]);

  return (
    <details className="text-muted-foreground text-xs break-words">
      <summary>Diagnostics</summary>
      <ul className="m-0 grid list-none gap-1 p-0 pt-2">
        {probes.map(({ name, url }) => (
          <li key={name}>
            <strong>{name}</strong>: {lines[name] ?? "…"}
            <br />
            <code>{url}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}
