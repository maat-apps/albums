import { useEffect, useState } from "react";

import { normalize, pickMatch } from "../../lib/cover-lookup";
import { findLinks, searchMusicBrainz } from "../../lib/musicbrainz";
import type { Album } from "../../lib/schemas";

// TEMPORARY (PR #34): compares where an album's streaming links can come
// from, to see on a phone whether Wikidata could replace or fill in for
// MusicBrainz. Wikidata keeps Deezer (P2723), Spotify (P2205) and Apple
// Music (P2281) album IDs; its SPARQL endpoint is meant to be readable
// from the browser.

type Query = { artist: string; title: string };
type Probe = { name: string; run: () => Promise<string> };

const SPARQL_URL = "https://query.wikidata.org/sparql";

const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const sparqlString = (value: string) =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

const LINK_PARTS = `
  OPTIONAL { ?album wdt:P2723 ?deezer }
  OPTIONAL { ?album wdt:P2205 ?spotify }
  OPTIONAL { ?album wdt:P2281 ?apple }`;

type Row = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Row[]> {
  const params = new URLSearchParams({ query, format: "json" });
  const response = await fetch(`${SPARQL_URL}?${params}`, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as {
    results?: { bindings?: Row[] };
  };
  return body.results?.bindings ?? [];
}

function describeLinks(rows: Row[]): string {
  const pick = (key: string) =>
    rows.map((row) => row[key]?.value).find(Boolean);
  const deezer = pick("deezer");
  const spotify = pick("spotify");
  const apple = pick("apple");
  const entity = pick("album")?.replace("http://www.wikidata.org/entity/", "");
  return [
    `${entity ?? "?"}`,
    `deezer: ${deezer ? `https://www.deezer.com/album/${deezer}` : "—"}`,
    `spotify: ${spotify ? `https://open.spotify.com/album/${spotify}` : "—"}`,
    `apple: ${apple ? `https://music.apple.com/us/album/${apple}` : "—"}`,
  ].join(" · ");
}

function asAlbum(album: Query): Album {
  return {
    ...album,
    id: "diagnostics",
    year: null,
    status: "toListen",
    createdAt: "",
    updatedAt: "",
  };
}

async function musicBrainzGroup(album: Query): Promise<string | null> {
  const outcome = pickMatch(asAlbum(album), await searchMusicBrainz(album));
  return outcome.kind === "match" ? outcome.match.id : null;
}

function probes(album: Query): Probe[] {
  return [
    {
      name: "musicbrainz-links",
      run: async () => {
        const group = await musicBrainzGroup(album);
        if (!group) return "no sure MusicBrainz match";
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const links = await findLinks(group);
        return `${group} · deezer: ${links.deezer ?? "—"} · spotify: ${links.spotify ?? "—"} · apple: ${links.appleMusic ?? "—"}`;
      },
    },
    {
      name: "wikidata-search",
      run: async () => {
        const search = (language: string) => `{
          SERVICE wikibase:mwapi {
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
                            wikibase:api "EntitySearch";
                            mwapi:search ${sparqlString(album.title)};
                            mwapi:language "${language}".
            ?album wikibase:apiOutputItem mwapi:item.
          }
        }`;
        const rows = await sparql(`
          SELECT DISTINCT ?album ?performer ?deezer ?spotify ?apple WHERE {
            ${search("en")} UNION ${search("pl")}
            ?album wdt:P175 ?p.
            ?p rdfs:label ?performer.
            FILTER(LANG(?performer) IN ("en", "pl", "mul"))
            ${LINK_PARTS}
          } LIMIT 50`);
        const wanted = normalize(album.artist);
        const matching = rows.filter(
          (row) => normalize(row.performer?.value ?? "") === wanted,
        );
        if (matching.length === 0) {
          return `no album by this artist among ${rows.length} result(s)`;
        }
        const entity = matching[0].album?.value;
        return describeLinks(
          matching.filter((row) => row.album?.value === entity),
        );
      },
    },
    {
      name: "wikidata-by-musicbrainz-id",
      run: async () => {
        // After the other probe's MusicBrainz requests (about one a second).
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const group = await musicBrainzGroup(album);
        if (!group) return "no sure MusicBrainz match to look up";
        const rows = await sparql(`
          SELECT ?album ?deezer ?spotify ?apple WHERE {
            ?album wdt:P436 ${sparqlString(group)}.
            ${LINK_PARTS}
          }`);
        return rows.length > 0
          ? describeLinks(rows)
          : `${group} isn't linked from Wikidata`;
      },
    },
  ];
}

export function LookupDiagnostics({ artist, title }: Query) {
  const [lines, setLines] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const names = probes({ artist, title }).map((probe) => probe.name);

  useEffect(() => {
    let current = true;
    for (const { name, run } of probes({ artist, title })) {
      run()
        .catch((error: unknown) => `failed — ${describe(error)}`)
        .then((line) => {
          if (current) setLines((previous) => ({ ...previous, [name]: line }));
        });
    }
    return () => {
      current = false;
    };
  }, [artist, title]);

  const report = [
    `${artist} — ${title}`,
    ...names.map((name) => `${name}: ${lines[name] ?? "…"}`),
  ].join("\n");

  function copy() {
    navigator.clipboard.writeText(report).then(
      () => setCopied("yes"),
      () => setCopied("failed"),
    );
  }

  return (
    <details className="text-muted-foreground text-xs break-words">
      <summary>Diagnostics</summary>
      <button
        type="button"
        className="border-border mt-2 rounded-md border px-3 py-1.5"
        onClick={copy}
      >
        {copied === "yes"
          ? "Copied"
          : copied === "failed"
            ? "Couldn't copy"
            : "Copy diagnostics"}
      </button>
      <ul className="m-0 grid list-none gap-1 p-0 pt-2">
        {names.map((name) => (
          <li key={name}>
            <strong>{name}</strong>: {lines[name] ?? "…"}
          </li>
        ))}
      </ul>
    </details>
  );
}
