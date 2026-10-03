import { VinylRecord } from "@phosphor-icons/react";
import { startTransition, useEffect, useState } from "react";
import { useParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { MissingAlbum } from "../../components/missing-album";
import { useAlbum, useAlbumsReady } from "../../hooks/use-albums";
import { useSpotifyConnected } from "../../hooks/use-spotify";
import { useTranslation } from "../../i18n/use-translation";
import {
  applyMatch,
  withVerdict,
  type AlbumMatch,
} from "../../lib/cover-lookup";
import { SEARCHES } from "../../lib/cover-lookup-runner";
import { saveAlbum } from "../../lib/storage";

type Search =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "done"; matches: AlbumMatch[] };

/** A candidate's cover, straight from its source. */
function CandidateCover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(url === null);
  return (
    <span className="bg-muted text-muted-foreground grid size-16 shrink-0 place-items-center overflow-hidden rounded-md">
      {failed ? (
        <VinylRecord aria-hidden="true" className="size-1/3" />
      ) : (
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/**
 * "/covers/:id": the matches for one album (Spotify's when connected,
 * MusicBrainz's otherwise); picking one fills in what the album is missing,
 * "None of these" stops offering it.
 */
export function PickCoverView() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const ready = useAlbumsReady();
  const album = useAlbum(id);
  const back = useSmartBack("/covers");
  const source = useSpotifyConnected() ? "spotify" : "musicbrainz";
  // Tagged with the query it answers, so a stale answer reads as loading.
  const [answer, setAnswer] = useState<{ query: string; search: Search }>();
  const artist = album?.artist;
  const title = album?.title;

  useEffect(() => {
    if (artist === undefined || title === undefined) return;
    const controller = new AbortController();
    const query = `${source}|${artist}|${title}`;
    SEARCHES[source]({ artist, title }, controller.signal).then(
      (matches) => setAnswer({ query, search: { state: "done", matches } }),
      () => {
        if (!controller.signal.aborted) {
          setAnswer({ query, search: { state: "failed" } });
        }
      },
    );
    return () => controller.abort();
  }, [artist, title, source]);

  if (!album) return ready ? <MissingAlbum /> : null;
  const search: Search =
    answer?.query === `${source}|${album.artist}|${album.title}`
      ? answer.search
      : { state: "loading" };

  function pick(match: AlbumMatch) {
    if (!album) return;
    saveAlbum(applyMatch(album, match));
    startTransition(back);
  }

  function skip() {
    if (!album) return;
    saveAlbum(withVerdict(album, source, "skipped"));
    startTransition(back);
  }

  return (
    <div className="mx-auto grid min-h-dvh w-[min(100%,480px)] content-start gap-5 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <AppBar
        title={t("pickCover")}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
      />
      <div className="grid gap-1">
        <h2 className="font-heading m-0 text-xl font-semibold break-words">
          {album.title}
        </h2>
        <p className="text-muted-foreground m-0 break-words">
          {album.artist}
          {album.year !== null && ` · ${album.year}`}
        </p>
      </div>
      {search.state === "loading" && (
        <p className="text-muted-foreground m-0">{t("searching")}</p>
      )}
      {search.state === "failed" && (
        <p className="text-destructive m-0" role="alert">
          {t("lookupFailed")}
        </p>
      )}
      {search.state === "done" && search.matches.length === 0 && (
        <p className="text-muted-foreground m-0">{t("noCandidates")}</p>
      )}
      {search.state === "done" && search.matches.length > 0 && (
        <ul
          className="m-0 grid list-none gap-1 p-0"
          aria-label={t("candidates")}
        >
          {search.matches.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-1.5 text-left"
                onClick={() => pick(match)}
              >
                <CandidateCover url={match.coverUrl} />
                <span className="grid min-w-0 flex-1 text-sm leading-tight">
                  <span className="font-semibold break-words">
                    {match.title}
                  </span>
                  <span className="text-muted-foreground break-words">
                    {match.artist}
                    {match.year !== null && ` · ${match.year}`}
                    {match.type && ` · ${match.type}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="lg" onClick={skip}>
        {t("noneOfThese")}
      </Button>
    </div>
  );
}
