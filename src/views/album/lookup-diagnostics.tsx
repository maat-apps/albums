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

const URLS: Record<LookupSource, (album: Query) => string> = {
  deezer: deezerSearch,
  musicbrainz: musicBrainzSearch,
  itunes: itunesSearch,
};

type Query = { artist: string; title: string };

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function probe(source: LookupSource, album: Query): Promise<string> {
  const url = URLS[source](album);
  try {
    const matches = await SEARCHES[source](album, new AbortController().signal);
    return `OK — ${matches.length} result(s)`;
  } catch (error) {
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
}

export function LookupDiagnostics({ artist, title }: Query) {
  const [lines, setLines] = useState<Partial<Record<LookupSource, string>>>({});

  useEffect(() => {
    let current = true;
    for (const source of LOOKUP_SOURCES) {
      void probe(source, { artist, title }).then((line) => {
        if (current) setLines((previous) => ({ ...previous, [source]: line }));
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
        {LOOKUP_SOURCES.map((source) => (
          <li key={source}>
            <strong>{source}</strong>: {lines[source] ?? "…"}
            <br />
            <code>{URLS[source]({ artist, title })}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}
