import { CaretRight } from "@phosphor-icons/react";
import { startTransition } from "react";
import { useNavigate } from "react-router";

import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { useSmartBack } from "@maat-apps/ui/smart-back";
import { useAlbums } from "../../hooks/use-albums";
import { useCoverLookup } from "../../hooks/use-cover-lookup";
import { useTranslation } from "../../i18n/use-translation";
import { awaitsReview, needsLookup, notFound } from "../../lib/cover-lookup";
import type { Album } from "../../lib/schemas";

function AlbumLinks({
  label,
  albums,
  onOpen,
}: {
  label: string;
  albums: Album[];
  onOpen: (id: string) => void;
}) {
  if (albums.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="m-0 text-base font-semibold">{label}</h2>
      <ul className="m-0 grid list-none gap-1 p-0" aria-label={label}>
        {albums.map((album) => (
          <li key={album.id}>
            <button
              type="button"
              className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left"
              onClick={() => onOpen(album.id)}
            >
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-semibold">{album.title}</span>
                <span className="text-muted-foreground truncate text-sm">
                  {album.artist}
                  {album.year !== null && ` · ${album.year}`}
                </span>
              </span>
              <CaretRight aria-hidden="true" className="shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "/covers": looks covers (and missing years) up on MusicBrainz for every
 * album without one, then lists what needs a decision.
 */
export function CoversView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useSmartBack("/");
  const albums = useAlbums();
  const { phase, progress, start, stop } = useCoverLookup();
  const remaining = albums.filter(needsLookup).length;
  const toReview = albums.filter(awaitsReview);
  const missing = albums.filter(notFound);

  function open(id: string) {
    startTransition(() => navigate(`/covers/${encodeURIComponent(id)}`));
  }

  return (
    <div className="mx-auto grid min-h-dvh w-[min(100%,480px)] content-start gap-5 px-5 pt-27 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <AppBar
        title={t("findCovers")}
        backLabel={t("back")}
        onBack={() => startTransition(back)}
      />
      <p className="text-muted-foreground m-0">{t("findCoversIntro")}</p>
      <div className="grid gap-3">
        <p className="m-0" aria-live="polite">
          {phase === "running" && progress
            ? t("lookupProgress", {
                done: progress.done,
                total: progress.total,
              })
            : t("albumsWithoutCover", { count: remaining })}
        </p>
        {progress && phase !== "idle" && (
          <p className="text-muted-foreground m-0 text-sm">
            {t("lookupSummary", {
              matched: progress.matched,
              review: progress.review,
              notFound: progress.notFound,
            })}
          </p>
        )}
        {phase === "failed" && (
          <p className="text-destructive m-0 text-sm" role="alert">
            {t("lookupFailed")}
          </p>
        )}
        {phase === "running" ? (
          <Button variant="outline" size="lg" onClick={stop}>
            {t("stopLookup")}
          </Button>
        ) : (
          <Button size="lg" disabled={remaining === 0} onClick={start}>
            {t("startLookup")}
          </Button>
        )}
      </div>
      <AlbumLinks
        label={t("toReview", { count: toReview.length })}
        albums={toReview}
        onOpen={open}
      />
      <AlbumLinks
        label={t("notFoundCovers", { count: missing.length })}
        albums={missing}
        onOpen={open}
      />
    </div>
  );
}
