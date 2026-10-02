import { VinylRecord } from "@phosphor-icons/react";
import { startTransition, useEffect, useState } from "react";
import { useParams } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { MissingAlbum } from "../../components/missing-album";
import { useAlbum, useAlbumsReady } from "../../hooks/use-albums";
import { useTranslation } from "../../i18n/use-translation";
import { applyMatch } from "../../lib/cover-lookup";
import {
  coverArtUrl,
  searchReleaseGroups,
  type ReleaseGroup,
} from "../../lib/musicbrainz";
import { saveAlbum } from "../../lib/storage";

type Search =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "done"; groups: ReleaseGroup[] };

/** A candidate's cover, straight from the Cover Art Archive. */
function CandidateCover({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="bg-muted text-muted-foreground grid size-16 shrink-0 place-items-center overflow-hidden rounded-md">
      {failed ? (
        <VinylRecord aria-hidden="true" className="size-1/3" />
      ) : (
        <img
          src={coverArtUrl(id)}
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
 * "/covers/:id": MusicBrainz's matches for one album; picking one sets its
 * cover (and year, if missing), "None of these" stops offering it.
 */
export function PickCoverView() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const ready = useAlbumsReady();
  const album = useAlbum(id);
  const back = useSmartBack("/covers");
  const [search, setSearch] = useState<Search>({ state: "loading" });
  const artist = album?.artist;
  const title = album?.title;

  useEffect(() => {
    if (artist === undefined || title === undefined) return;
    const controller = new AbortController();
    searchReleaseGroups({ artist, title }, controller.signal).then(
      (groups) => setSearch({ state: "done", groups }),
      () => {
        if (!controller.signal.aborted) setSearch({ state: "failed" });
      },
    );
    return () => controller.abort();
  }, [artist, title]);

  if (!album) return ready ? <MissingAlbum /> : null;

  function pick(group: ReleaseGroup) {
    if (!album) return;
    saveAlbum(applyMatch(album, group));
    startTransition(back);
  }

  function skip() {
    if (!album) return;
    saveAlbum({ ...album, lookup: "skipped" });
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
      {search.state === "done" && search.groups.length === 0 && (
        <p className="text-muted-foreground m-0">{t("noCandidates")}</p>
      )}
      {search.state === "done" && search.groups.length > 0 && (
        <ul
          className="m-0 grid list-none gap-1 p-0"
          aria-label={t("candidates")}
        >
          {search.groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-1.5 text-left"
                onClick={() => pick(group)}
              >
                <CandidateCover id={group.id} />
                <span className="grid min-w-0 flex-1 text-sm leading-tight">
                  <span className="font-semibold break-words">
                    {group.title}
                  </span>
                  <span className="text-muted-foreground break-words">
                    {group.artist}
                    {group.year !== null && ` · ${group.year}`}
                    {group.primaryType && ` · ${group.primaryType}`}
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
